/* timeAgo() from digital-romanian-screens.html's <script>, shared by the
   workspace views so "Just now" / "Yesterday" / "2 hours ago" is worded
   identically wherever it appears. */

export function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? "1 minute ago" : `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "Yesterday" : `${d} days ago`;
  const w = Math.round(d / 7);
  return w === 1 ? "1 week ago" : `${w} weeks ago`;
}
