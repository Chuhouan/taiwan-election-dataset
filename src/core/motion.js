export const MOTION = Object.freeze({
  press: 120,
  hover: 160,
  panel: 300,
  data: 400,
  layout: 580,
  transform: 780,
  intro: 900,
});
export const motionDuration = (kind = "layout") =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : MOTION[kind];
export const motionEase = "cubic-bezier(.22,.61,.36,1)";
/** Cancel only this channel; an obsolete animation never commits application state. */
export function animateMotion(
  node,
  channel,
  frames,
  kind = "panel",
  options = {},
) {
  if (!node) return;
  const id = "atlas-" + channel;
  for (const animation of node.getAnimations())
    if (animation.id === id) animation.cancel();
  if (!motionDuration(kind)) return;
  const animation = node.animate(frames, {
    duration: motionDuration(kind),
    easing: motionEase,
    id,
    ...options,
  });
  animation.finished.catch(() => {});
  return animation;
}
