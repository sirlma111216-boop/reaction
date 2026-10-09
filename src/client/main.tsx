import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jua';
import '@fontsource/gaegu/400.css';
import '@fontsource/gaegu/700.css';
import 'pretendard/dist/web/static/pretendard-dynamic-subset.css';
import './styles.css';
import { App } from './App';
import { imageSrc, loadAssetIndex } from './lib/assets';
import { audio } from './lib/audio';

loadAssetIndex().finally(() => {
  audio.init();
  // 종이 무늬(ui-paper)가 있으면 바탕에 반복해 깐다
  const paper = imageSrc('ui-paper', 128);
  if (paper) document.documentElement.style.setProperty('--paper-tile', `url(${paper})`);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
