export const categoryDepartments = Object.freeze({
  ROAD_DAMAGE: 'Roads & Infrastructure',
  WATER_SUPPLY: 'Water Supply',
  DRAINAGE: 'Drainage',
  WASTE_MANAGEMENT: 'Sanitation',
  STREETLIGHT: 'Electricity',
  PUBLIC_HEALTH: 'Public Health',
  PUBLIC_PROPERTY: 'Public Works',
  OTHER: 'General Administration'
});

export const categories = Object.freeze(Object.keys(categoryDepartments));
export const departments = Object.freeze([...new Set(Object.values(categoryDepartments))]);
export const severities = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
