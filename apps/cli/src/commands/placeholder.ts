import { printWarning, printSection } from '../utils/print.js';

export async function placeholderCommand(commandName: string): Promise<void> {
  printSection('Command Not Available');
  printWarning(`"${commandName}" is not implemented in Phase 1.`);
  console.log('\nThis command will be added in a later phase.');
  console.log('\nAvailable commands in Phase 1:');
  console.log('  • init    - Initialize KontextMind in a project');
  console.log('  • status  - Show KontextMind status');
  console.log('  • doctor  - Check KontextMind health\n');
}