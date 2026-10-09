import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jua';
import '@fontsource/gaegu/400.css';
import '@fontsource/gaegu/700.css';
import 'pretendard/dist/web/static/pretendard-dynamic-subset.css';
import './styles.css';
import { App } from './App';
import { loadAssetIndex } from './lib/assets';
import { audio } from './lib/audio';

loadAssetIndex().finally(() => {
  audio.init();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
