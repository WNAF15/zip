import { OrdinaryClass } from './classes/ordinary/OrdinaryClass.js';
import { TempterClass } from './classes/tempter/TempterClass.js';
const classes=[OrdinaryClass,TempterClass];
export const getAvailableClasses=()=>classes.slice();
export const getClassById=id=>classes.find(item=>item.id===id)||null;
