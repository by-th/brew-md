import { useEffect, useState } from 'react';
import { SlotText } from 'slot-text/react';
import type { SlotOptions } from 'slot-text';
import 'slot-text/style.css';

type MotionProps = Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** The text to display; rolling animates whenever it changes. */
  text: string;
  /** Also roll in on mount (renders empty, then rolls to `text`). */
  reveal?: boolean;
  options?: SlotOptions;
};

/**
 * slot-text roll animation (textmotion.dev) wrapped for our app. Rolls
 * per-character whenever `text` changes; with `reveal`, also rolls in on mount.
 * Inherits the surrounding font so it measures glyph widths correctly.
 */
export function Motion({ text, reveal = false, options, ...rest }: MotionProps) {
  const [shown, setShown] = useState(reveal ? '' : text);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(text));
    return () => cancelAnimationFrame(id);
  }, [text]);
  return <SlotText text={shown} options={options} {...rest} />;
}
