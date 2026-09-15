import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { ArScreen } from './ArScreen.web';
import { ANSWER_SCREEN } from './panelBehaviour';
import type { CameraAdapter, CameraPermission } from '../adapters/camera';

/**
 * Assembled from parts so this file is not itself a match, and matched as an
 * `import`/`require` rather than as a substring: the criterion is about files
 * that *import* Viro, and a doc comment naming the package is not an import.
 */
const VIRO_PACKAGE = ['@reactvision', 'react-viro'].join('/');
const VIRO_IMPORT = new RegExp(
  `(?:from|require\\(\\s*)\\s*['"]${VIRO_PACKAGE.replace('/', '\\/')}['"]`,
);

function sourceFiles(dir = 'src'): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

function cameraAdapter(permission: CameraPermission) {
  const requests: number[] = [];
  const camera: CameraAdapter = { permission, request: () => requests.push(1) };
  return { camera, requests };
}

const props = (permission: CameraPermission) => ({
  screen: ANSWER_SCREEN,
  puzzle: { text: '5 + 2 = ?', answer: 7 },
  onEvent: () => undefined,
  audio: { play: () => undefined },
  camera: cameraAdapter(permission).camera,
});

describe('the web platform split', () => {
  it('AC17: only the native AR files import Viro', () => {
    const importers = sourceFiles().filter((path) =>
      VIRO_IMPORT.test(readFileSync(path, 'utf8')),
    );

    expect(importers.sort()).toEqual(['src/ui/ArScreen.tsx', 'src/ui/PuzzlePanel.tsx']);
  });

  it('AC17: neither web file imports Viro', () => {
    for (const path of ['src/ui/ArScreen.web.tsx', 'src/ui/PuzzlePanel.web.tsx']) {
      expect(VIRO_IMPORT.test(readFileSync(path, 'utf8'))).toBe(false);
    }
  });

  it('AC20: the web puzzle screen shows the panel and no camera', () => {
    // Denied on purpose: web must not consult the camera at all.
    const { container } = render(createElement(ArScreen, props('denied')));

    expect(screen.getByText('5 + 2 = ?')).toBeTruthy();
    expect(container.querySelectorAll('video')).toHaveLength(0);
    expect(screen.queryByText('Kamera tarvitaan tehtävän avaamiseen.')).toBeNull();
  });
});
