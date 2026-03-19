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
  ShampafEntry,
  ShampafVacation,
  Assignment,
  Activation,
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
  shampafEntries: EntityTable<ShampafEntry, 'id'>;
  shampafVacations: EntityTable<ShampafVacation, 'id'>;
  assignments: EntityTable<Assignment, 'id'>;
  activations: EntityTable<Activation, 'id'>;
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

db.version(2).stores({
  soldiers: 'id, militaryId, lastName, rank, platoonId, squadId, trainedRole',
  shampafEntries: 'id, soldierId, startDateTime, endDateTime',
  shampafVacations: 'id, shampafEntryId, soldierId, startDateTime, endDateTime',
  assignments: 'id, soldierId, type, tankId, role, startDateTime, endDateTime',
});

db.version(3).stores({
  activations: 'id, startDate, endDate',
});

export { db };
