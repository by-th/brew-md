import { Motion } from './Motion';

export function Brand() {
  return (
    <div id="brand" className="enter">
      <span className="mark">
        <Motion text="brew" reveal />
        <span className="dot">.</span>
        <span className="md">md</span>
      </span>
    </div>
  );
}
