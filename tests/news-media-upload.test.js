const test=require('node:test');
const assert=require('node:assert/strict');
const media=require('../api/news-media-upload')._test;

test('news media upload limits are image 5MB and video 20MB',()=>{
  const image=media.mediaRules('news-images/example.webp');
  const video=media.mediaRules('news-videos/example.mp4');
  assert.equal(image.kind,'image');
  assert.equal(image.maximumSizeInBytes,5*1024*1024);
  assert.deepEqual(image.allowedContentTypes,['image/jpeg','image/png','image/webp']);
  assert.equal(video.kind,'video');
  assert.equal(video.maximumSizeInBytes,20*1024*1024);
  assert.deepEqual(video.allowedContentTypes,['video/mp4','video/webm']);
});

test('news media upload rejects paths outside news media folders',()=>{
  assert.throws(()=>media.mediaRules('avatars/example.png'),/INVALID_MEDIA_PATH/);
});

test('client upload payload requires an admin LINE token',()=>{
  assert.equal(media.parseAdminPayload(JSON.stringify({idToken:'fixture-token'})).idToken,'fixture-token');
  assert.throws(()=>media.parseAdminPayload('{}'),/MISSING_ID_TOKEN/);
  assert.throws(()=>media.parseAdminPayload('{bad'),/INVALID_CLIENT_PAYLOAD/);
});

test('admin news frontend uses Blob direct uploads and practical limits',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const js=fs.readFileSync(path.join(__dirname,'../admin-news.js'),'utf8');
  assert.match(js,/IMAGE_SOURCE_MAX=15\*1024\*1024/);
  assert.match(js,/IMAGE_UPLOAD_MAX=5\*1024\*1024/);
  assert.match(js,/VIDEO_UPLOAD_MAX=20\*1024\*1024/);
  assert.match(js,/api\/news-media-upload/);
  assert.match(js,/@vercel\/blob@2\.8\.2\/client/);
  assert.match(js,/optimizeImage/);
  assert.doesNotMatch(js,/readFileBase64/);
});
