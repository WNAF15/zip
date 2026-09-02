// Совместимый фасад старой системы структур.
// Реальная логика перенесена в универсальный BuildingGenerator.
import { CIRCLE_ONE_LANDMARKS } from '../circles/CircleOneLandmarks.js';
import { getCircleOneBuildingBlueprints } from '../buildings/BuildingBlueprintRegistry.js';
import { getBuildingsForChunk, isInsideBlueprintBuilding, getBlueprintAt, getBuildingFloorAt } from '../buildings/BuildingGenerator.js';

const BLUEPRINTS = Object.freeze(getCircleOneBuildingBlueprints(CIRCLE_ONE_LANDMARKS));
export function getStructureBlueprints(){ return BLUEPRINTS; }
export function getStructuresForChunk(cx,cy){ return getBuildingsForChunk(cx,cy,BLUEPRINTS); }
export function isInsideStructureBuilding(x,y){ return isInsideBlueprintBuilding(x,y,BLUEPRINTS); }
export function getStructureAt(x,y){ return getBlueprintAt(x,y,BLUEPRINTS); }
export function getStructureFloorAt(x,y){ return getBuildingFloorAt(x,y,BLUEPRINTS); }
