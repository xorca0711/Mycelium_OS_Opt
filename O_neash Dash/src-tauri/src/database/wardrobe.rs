use sqlx::{Row, SqliteConnection};

fn quote_identifier(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

// Locate balanced CHECK expressions, preserving quoted strings and all unrelated
// columns/constraints. Older personal databases may contain additional columns.
fn without_category_check(sql: &str) -> Result<String, sqlx::Error> {
    let bytes = sql.as_bytes();
    let mut result = sql.to_owned();
    let mut ranges = Vec::new();
    let mut position = 0;
    let mut quote = None;
    while position < bytes.len() {
        let byte = bytes[position];
        if let Some(delimiter) = quote {
            if byte == delimiter {
                if bytes.get(position + 1) == Some(&delimiter) {
                    position += 2;
                    continue;
                }
                quote = None;
            }
            position += 1;
            continue;
        }
        if byte == b'\'' || byte == b'"' || byte == b'`' {
            quote = Some(byte);
            position += 1;
            continue;
        }
        if bytes.get(position..position + 5).is_some_and(|word| word.eq_ignore_ascii_case(b"CHECK")) {
            let start = position;
            position += 5;
            while bytes.get(position).is_some_and(u8::is_ascii_whitespace) { position += 1; }
            if bytes.get(position) != Some(&b'(') { continue; }
            let expression_start = position + 1;
            let mut depth = 1;
            position += 1;
            let mut expression_quote = None;
            while position < bytes.len() && depth > 0 {
                let byte = bytes[position];
                if let Some(delimiter) = expression_quote {
                    if byte == delimiter {
                        if bytes.get(position + 1) == Some(&delimiter) { position += 2; continue; }
                        expression_quote = None;
                    }
                } else if byte == b'\'' || byte == b'"' || byte == b'`' {
                    expression_quote = Some(byte);
                } else if byte == b'(' { depth += 1; }
                else if byte == b')' { depth -= 1; }
                position += 1;
            }
            if depth != 0 { return Err(sqlx::Error::Protocol("Unbalanced legacy category constraint".into())); }
            let expression = sql[expression_start..position - 1].trim_start();
            let normalized = expression.trim_start_matches(['"', '`', '[']).to_ascii_lowercase();
            if normalized.starts_with("category") {
                ranges.push(start..position);
            }
        } else {
            position += 1;
        }
    }
    for range in ranges.into_iter().rev() { result.replace_range(range, ""); }
    Ok(result)
}

pub async fn upgrade_wardrobe(connection: &mut SqliteConnection) -> Result<(), sqlx::Error> {
    let original: String = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='wardrobe_wiki_entries'",
    ).fetch_one(&mut *connection).await?;
    let unconstrained = without_category_check(&original)?;
    if unconstrained != original {
        let schema_start = unconstrained.find('(')
            .ok_or_else(|| sqlx::Error::Protocol("Invalid wardrobe schema".into()))?;
        let dependents: Vec<String> = sqlx::query_scalar(
            "SELECT sql FROM sqlite_master WHERE tbl_name='wardrobe_wiki_entries'
             AND type IN ('trigger','index') AND sql IS NOT NULL",
        ).fetch_all(&mut *connection).await?;
        let columns = sqlx::query("PRAGMA table_info(wardrobe_wiki_entries)")
            .fetch_all(&mut *connection).await?;
        let column_list = columns.iter().map(|row| quote_identifier(&row.get::<String, _>("name")))
            .collect::<Vec<_>>().join(", ");
        sqlx::raw_sql(&format!(
            "CREATE TABLE _mycelium_wardrobe_upgrade {};",
            &unconstrained[schema_start..].trim_end_matches(';'),
        )).execute(&mut *connection).await?;
        sqlx::query(&format!(
            "INSERT INTO _mycelium_wardrobe_upgrade ({column_list})
             SELECT {column_list} FROM wardrobe_wiki_entries",
        )).execute(&mut *connection).await?;
        sqlx::raw_sql(
            "DROP TABLE wardrobe_wiki_entries;
             ALTER TABLE _mycelium_wardrobe_upgrade RENAME TO wardrobe_wiki_entries;",
        ).execute(&mut *connection).await?;
        for sql in dependents {
            sqlx::raw_sql(&sql).execute(&mut *connection).await?;
        }
    }
    sqlx::query(
        "UPDATE wardrobe_wiki_entries
         SET category = CASE category WHEN 'look' THEN 'genre' WHEN 'creator' THEN 'brand' END
         WHERE category IN ('look','creator')",
    ).execute(connection).await?;
    Ok(())
}
