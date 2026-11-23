import { libraryDirectory } from '../library-location.mjs';
import { fileURLToPath } from 'node:url';
import { importBrowserLibrary, importMissingSeedRecords, migrateLibrary, readLegacyLibrary } from '../lib/library-migration.mjs';
import { backupLibrary, restoreLibraryBackup, verifyLibraryBackup } from '../lib/library-backup.mjs';
import { readStoredLibrary } from '../lib/library-sqlite.mjs';

const [, , command, ...args] = process.argv;
const controls = `用法 (由 ILIA_DATA_DIR 指定本机资料目录)
  node scripts/library-db.mjs status
  node scripts/library-db.mjs migrate [--dry-run]
  node scripts/library-db.mjs import-seed [--dry-run]
  node scripts/library-db.mjs import-browser <导出 JSON> <新冲突报告 JSON>
  node scripts/library-db.mjs backup <新备份目录>
  node scripts/library-db.mjs verify-backup <备份目录>
  node scripts/library-db.mjs restore <备份目录> <新资料目录>`;

const report = (message, result) => console.log(JSON.stringify({ message, ...result }, null, 2));
const summary = state => state ? {
  resources: state.resources.length, lessons: state.lessons.length,
  ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}),
} : {};

async function run() {
  if (command === 'status' && !args.length) {
    const sqlite = readStoredLibrary(libraryDirectory);
    const legacy = sqlite ? null : await readLegacyLibrary(libraryDirectory);
    report('本机资料状态', {
      directory: fileURLToPath(libraryDirectory), source: sqlite ? 'sqlite' : legacy ? 'json' : 'none',
      ...summary(sqlite || legacy),
    });
  } else if (['migrate', 'import-seed'].includes(command) && (!args.length || (args.length === 1 && args[0] === '--dry-run'))) {
    const dryRun = args.length > 0;
    const operation = command === 'migrate' ? migrateLibrary : importMissingSeedRecords;
    const { state, ...result } = await operation(libraryDirectory, { dryRun });
    report(dryRun ? '预演完成，资料未写入。' : '本机资料已准备。', { ...result, ...summary(state) });
  } else if (command === 'import-browser' && args.length === 2) {
    report('浏览器资料比对完成。', await importBrowserLibrary(libraryDirectory, ...args));
  } else if (command === 'backup' && args.length === 1) {
    report('本机资料已备份并校验。', await backupLibrary(libraryDirectory, ...args));
  } else if (command === 'verify-backup' && args.length === 1) {
    report('备份已通过校验。', await verifyLibraryBackup(...args));
  } else if (command === 'restore' && args.length === 2) {
    report('本机资料已恢复至新目录。', await restoreLibraryBackup(...args));
  } else if (command === '--help' || command === '-h') {
    console.log(controls);
  } else {
    console.error(controls);
    process.exitCode = 1;
  }
}

try {
  await run();
} catch (error) {
  console.error('本机资料操作失败。', error.message);
  process.exitCode = 1;
}
