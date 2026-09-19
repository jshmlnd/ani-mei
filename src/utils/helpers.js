export function formatDate(date) {
  if (!date?.year) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[(date.month || 1) - 1]} ${date.day || ''} ${date.year}`.trim();
}

export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}