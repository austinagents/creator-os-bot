function generateSlug(input) {
  // Lowercase, replace non-alphanumeric characters with hyphens,
  // collapse repeated separators, trim edge hyphens, and cap length.
  let slug = String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 20);

  if (slug.length === 0) {
    return 'creator';
  }

  return slug;
}

function normalizeCode(value) {
  return String(value || '').trim().toLowerCase();
}

function generateUniqueSlug(username, existingSlugs) {
  const originalSlug = generateSlug(username);
  let slug = originalSlug;
  const normalizedExistingSlugs = existingSlugs.map(normalizeCode);

  while (normalizedExistingSlugs.includes(slug)) {
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = `${originalSlug}-${suffix}`;
  }

  return slug;
}

module.exports = {
  generateSlug,
  normalizeCode,
  generateUniqueSlug
};
