import type { EngineType, LayerEngine, ControlParam } from './types';
import { RastrEngine, rastrParams } from './rastr-engine';
import { TextrEngine, textrParams } from './textr-engine';
import { DitherEngine, ditherParams } from './dither-engine';
import { ImgDitherEngine, imgDitherParams } from './img-dither-engine';
import { Object3DEngine, object3dParams } from './object3d-engine';
import { LabelEngine, labelParams } from './label-engine';
import { LogoEngine, logoParams } from './logo-engine';

interface EngineRegistryEntry {
  label: string;
  createEngine: () => LayerEngine;
  params: ControlParam[];
  defaultName: string;
}

export const engineRegistry: Record<EngineType, EngineRegistryEntry> = {
  rastr: {
    label: 'RASTR',
    createEngine: () => new RastrEngine(),
    params: rastrParams,
    defaultName: 'Rastr Layer',
  },
  textr: {
    label: 'TEXTR',
    createEngine: () => new TextrEngine(),
    params: textrParams,
    defaultName: 'Textr Layer',
  },
  dither: {
    label: 'TYPO',
    createEngine: () => new DitherEngine(),
    params: ditherParams,
    defaultName: 'Dither Layer',
  },
  'img-dither': {
    label: 'IMG',
    createEngine: () => new ImgDitherEngine(),
    params: imgDitherParams,
    defaultName: 'Image Layer',
  },
  object3d: {
    label: '3D',
    createEngine: () => new Object3DEngine(),
    params: object3dParams,
    defaultName: '3D Layer',
  },
  label: {
    label: 'LABEL',
    createEngine: () => new LabelEngine(),
    params: labelParams,
    defaultName: 'Label Layer',
  },
  logo: {
    label: 'LOGO',
    createEngine: () => new LogoEngine(),
    params: logoParams,
    defaultName: 'Logo Layer',
  },
};

export function getDefaultParams(engineType: EngineType): Record<string, any> {
  const entry = engineRegistry[engineType];
  return entry.params.reduce((acc, p) => {
    acc[p.key] = p.default;
    return acc;
  }, {} as Record<string, any>);
}
