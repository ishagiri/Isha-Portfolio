/**
 * Protect sensitive backend files and environment configuration
 * from being served via static requests.
 */
function protectSensitiveFiles(req, res, next) {
  const url = req.path.toLowerCase();

  // Block any request trying to access .env, git, node_modules, server files, or package configs
  if (
    url.startsWith('/.env') ||
    url.includes('/.env') ||
    url.startsWith('/.git') ||
    url.startsWith('/server') ||
    url.startsWith('/node_modules') ||
    url === '/package.json' ||
    url === '/package-lock.json' ||
    url === '/schema.sql' ||
    url === '/database.sql'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Access to sensitive system files is blocked.',
    });
  }

  next();
}

module.exports = {
  protectSensitiveFiles,
};
