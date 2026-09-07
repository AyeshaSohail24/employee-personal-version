import { runStage2Verification } from '../src/services/verifyStage2.js';
import { runStage3Verification } from '../src/services/verifyStage3.js';
import { runStage4Verification } from '../src/services/verifyStage4.js';
import { runStage5Verification } from '../src/services/verifyStage5.js';
import { runStage6Verification } from '../src/services/verifyStage6.js';
import { runStage7Verification } from '../src/services/verifyStage7.js';
import { runStage8Verification } from '../src/services/verifyStage8.js';
import { runStage9Verification } from '../src/services/verifyStage9.js';
import { runStage10Verification } from '../src/services/verifyStage10.js';
import { verifyStage11 } from '../src/services/verifyStage11.js';

async function main() {
  console.log('====================================================');
  console.log('RUNNING COMPLETE ALL-STAGES VERIFICATION (2 - 11)');
  console.log('====================================================\n');

  try {
    await runStage2Verification();
    console.log('STAGE 2: PASSED\n');

    await runStage3Verification();
    console.log('STAGE 3: PASSED\n');

    await runStage4Verification();
    console.log('STAGE 4: PASSED\n');

    await runStage5Verification();
    console.log('STAGE 5: PASSED\n');

    await runStage6Verification();
    console.log('STAGE 6: PASSED\n');

    await runStage7Verification();
    console.log('STAGE 7: PASSED\n');

    await runStage8Verification();
    console.log('STAGE 8: PASSED\n');

    await runStage9Verification();
    console.log('STAGE 9: PASSED\n');

    await runStage10Verification();
    console.log('STAGE 10: PASSED\n');

    const res11 = await verifyStage11();
    if (!res11.success) {
      throw new Error(`Stage 11 failed: ${res11.error}`);
    }
    console.log('STAGE 11: PASSED\n');

    console.log('====================================================');
    console.log('🎉 ALL STAGE VERIFICATION SUITES PASSED 100% CLEANLY!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  }
}

main();
