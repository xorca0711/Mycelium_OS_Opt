import { Clipboard } from 'pixelarticons/react';
import ComingSoonView from '../components/ComingSoonView';

export default function WishlistView() {
  return (
    <ComingSoonView
      icon={<Clipboard width={40} height={40} />}
      label="wishlist"
      description="clothes to buy, with working links — coming soon"
    />
  );
}
