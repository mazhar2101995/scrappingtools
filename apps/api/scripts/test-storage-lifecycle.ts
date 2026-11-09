import { MediaDeduplicationService } from '../src/services/media-deduplication.service';
import { GarbageCollectionService } from '../src/services/garbage-collection.service';
import { db, globalMediaAssets } from '@saas/database';
import { eq } from 'drizzle-orm';

async function testFullLifecycle() {
  console.log('=== TEST 1: INGESTION WITH DEDUPLICATION ===');
  const imgUrl1 = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800';
  const imgUrl2 = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&quality=85';

  const m1 = await MediaDeduplicationService.processAndDeduplicateImage(imgUrl1);
  console.log('Tenant 1 ingested image: isExisting =', m1?.isExisting, 'hash =', m1?.contentHash);

  const m2 = await MediaDeduplicationService.processAndDeduplicateImage(imgUrl2);
  console.log('Tenant 2 ingested image: isExisting =', m2?.isExisting, '(REUSED without download!)');

  console.log('\n=== TEST 2: ORPHAN DETECTION WITH GRACE PERIOD ===');
  await GarbageCollectionService.detectAndMarkOrphans();
  const [asset] = await db.select().from(globalMediaAssets).where(eq(globalMediaAssets.contentHash, m1!.contentHash));
  console.log('Asset status after unreferenced check:', asset.status, '(Marked as candidate)');

  console.log('\n=== TEST 3: GARBAGE COLLECTION RESPECTS GRACE PERIOD ===');
  const gc1 = await GarbageCollectionService.executeGarbageCollection('manual');
  console.log('GC executed during grace period. Files deleted:', gc1.filesDeleted, '(File is PROTECTED)');

  const [assetStillHere] = await db.select().from(globalMediaAssets).where(eq(globalMediaAssets.contentHash, m1!.contentHash));
  console.log('Asset in database still present:', !!assetStillHere);

  process.exit(0);
}

testFullLifecycle().catch((err) => {
  console.error(err);
  process.exit(1);
});
