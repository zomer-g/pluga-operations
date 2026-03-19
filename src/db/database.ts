import Dexie, { type EntityTable } from 'dexie';
import type {
  Soldier,
  EquipmentType,
  EquipmentAssignment,
  StatusEntry,
  Tank,
  TankCrewAssignment,
  Platoon,
  Squad,
} from './schema';

const db = new Dexie('PlugaOperationsDB') as Dexie & {
  soldiers: EntityTable<Soldier, 'id'>;
  equipmentTypes: EntityTable<EquipmentType, 'id'>;
  equipmentAssignments: EntityTable<EquipmentAssignment, 'id'>;
  statusEntries: EntityTable<StatusEntry, 'id'>;
  tanks: EntityTable<Tank, 'id'>;
  tankCrewAssignments: EntityTable<TankCrewAssignment, 'id'>;
  platoons: EntityTable<Platoon, 'id'>;
  squads: EntityTable<Squad, 'id'>;
};

db.version(1).stores({
  soldiers: 'id, militaryId, lastName, rank, platoonId, squadId',
  equipmentTypes: 'id, category, name',
  equipmentAssignments: 'id, soldierId, equipmentTypeId, signedInDate',
  statusEntries: 'id, soldierId, status, startDate, endDate',
  tanks: 'id, designation, platoonId, status',
  tankCrewAssignments: 'id, tankId, soldierId, role, endDate',
  platoons: 'id, number',
  squads: 'id, platoonId, number',
});

export { db };
