import { ImageSharp } from 'pixelarticons/react';
import ComingSoonView from '../components/ComingSoonView';

export default function MoodboardView() {
  return (
    <ComingSoonView
      icon={<ImageSharp width={40} height={40} />}
      label="moodboard"
      description="image import & moodboard canvas — coming soon"
    />
  );
}
