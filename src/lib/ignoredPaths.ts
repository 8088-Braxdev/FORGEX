// Shared ignore list for folder and GitHub imports.
export const IGNORED_PATHS =
  /(^|\/)(node_modules|\.git|\.next|dist|build|coverage|vendor)(\/|$)|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.min\.(js|css)$|\.snap$/i;