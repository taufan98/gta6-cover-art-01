// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo;
// ?shot=cover shows the cover alone, full frame. `photo` picks the sample
// (samples/<photo>.jpg), `caption` the title, `sub` the subtitle, `layout` and
// `grade` the look. window.__shotReady is set once painted.
export async function runShot(shot, query, load) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const layout = query.get('layout');
  const grade = query.get('grade');
  if (layout) {
    const btn = document.querySelector(`[data-layout="${layout}"]`);
    if (btn) btn.click();
  }
  if (grade) {
    const btn = document.querySelector(`[data-grade="${grade}"]`);
    if (btn) btn.click();
  }
  await load(
    `samples/${query.get('photo') ?? 'pier'}.jpg`,
    query.get('caption') ?? 'Vice Coast',
    query.get('sub') ?? 'where the sun never sets on the score',
  );
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
