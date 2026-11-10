// RP MotionStudio desktop — Copyright 2026 Rafael Posada. Apache-2.0.
// Once an installer is written and checked, the unpacked app it came from is
// only a second copy of the program: Mac cleaners list it as a duplicate and
// it holds ~400 MB per platform. Remove it, but only when it is a package
// folder this repository built (dist-desktop/packages/<name>).
const fs = require('node:fs'), path = require('node:path');

const packages = path.resolve(__dirname, '..', 'dist-desktop', 'packages');

function builtPackageFolder(target) {
  if (!target) return null;
  let folder = path.resolve(target);
  if (folder.endsWith('.app')) folder = path.dirname(folder);
  try { folder = fs.realpathSync(folder); } catch { return null; }
  let root; try { root = fs.realpathSync(packages); } catch { return null; }
  return path.dirname(folder) === root && path.basename(folder) !== '' ? folder : null;
}

function removeBuiltPackage(target) {
  if (process.env.RP_KEEP_PACKAGE === '1') return null;
  const folder = builtPackageFolder(target);
  if (!folder) return null;
  fs.rmSync(folder, { recursive: true, force: true });
  return folder;
}

module.exports = { builtPackageFolder, removeBuiltPackage };
