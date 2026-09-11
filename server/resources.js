// Registry mapping the app's collection names (the Firestore-era API the client
// still speaks) onto relational tables. Every SQL identifier the data routes
// use comes from here — never from request input.
//
// Field types:
//   text | int | num | bool | date ("YYYY-MM-DD") | datetime ("YYYY-MM-DDTHH:mm") | ts (ISO instant)
// `ref` names the collection a column points at (empty string → NULL, and
// orphans are cleaned on restore). `required` marks NOT NULL references.

const f = (col, type = 'text', extra = {}) => ({ col, type, ...extra });

export const RESOURCES = {
  // ----- Personnel -----
  soldiers: {
    table: 'soldiers',
    route: '/soldiers',
    order: 'last_name, first_name',
    fields: {
      militaryId: f('military_id'),
      firstName: f('first_name'),
      lastName: f('last_name'),
      rank: f('rank'),
      phoneNumber: f('phone_number'),
      emergencyContact: f('emergency_contact'),
      emergencyPhone: f('emergency_phone'),
      email: f('email'),
      bloodType: f('blood_type'),
      medicalNotes: f('medical_notes'),
      uniformSizeTop: f('uniform_size_top'),
      uniformSizeBottom: f('uniform_size_bottom'),
      shoeSize: f('shoe_size', 'num'),
      helmetSize: f('helmet_size'),
      platoonId: f('platoon_id', 'text', { ref: 'platoons' }),
      squadId: f('squad_id', 'text', { ref: 'squads' }),
      trainedRole: f('trained_role', 'enum'),
      profileImageUrl: f('profile_image_url'),
      createdAt: f('created_at', 'ts'),
      updatedAt: f('updated_at', 'ts'),
    },
    composites: {
      personalItems: {
        uniformsB: 'pi_uniforms_b',
        overalls: 'pi_overalls',
        underwear: 'pi_underwear',
        shoes: 'pi_shoes',
        cigarettes: 'pi_cigarettes',
      },
    },
    dependents: [
      'statusEntries', 'equipmentAssignments', 'tankCrewAssignments', 'assignments',
      'shampafEntries', 'shampafVacations', 'routineTemplates', 'platoons', 'squads',
    ],
  },

  statusEntries: {
    table: 'status_entries',
    route: '/soldiers',
    fields: {
      soldierId: f('soldier_id', 'text', { ref: 'soldiers', required: true }),
      status: f('status', 'enum'),
      startDate: f('start_date', 'date'),
      endDate: f('end_date', 'date'),
      notes: f('notes'),
      orderNumber: f('order_number'),
    },
  },

  platoons: {
    table: 'platoons',
    route: '/settings',
    order: 'number',
    fields: {
      name: f('name'),
      number: f('number', 'int'),
      commanderId: f('commander_id', 'text', { ref: 'soldiers' }),
    },
    dependents: ['soldiers', 'tanks', 'squads'],
  },

  squads: {
    table: 'squads',
    route: '/settings',
    fields: {
      platoonId: f('platoon_id', 'text', { ref: 'platoons', required: true }),
      name: f('name'),
      number: f('number', 'int'),
      leaderId: f('leader_id', 'text', { ref: 'soldiers' }),
    },
    dependents: ['soldiers'],
  },

  activations: {
    table: 'activations',
    route: '/soldiers',
    fields: {
      name: f('name'),
      startDate: f('start_date', 'date'),
      endDate: f('end_date', 'date'),
      notes: f('notes'),
    },
  },

  // ----- Equipment -----
  equipmentTypes: {
    table: 'equipment_types',
    route: '/equipment',
    order: 'name',
    fields: {
      name: f('name'),
      nameHe: f('name_he'),
      category: f('category', 'enum'),
      serialNumberRequired: f('serial_number_required', 'bool'),
      description: f('description'),
    },
  },

  equipmentAssignments: {
    table: 'equipment_assignments',
    route: '/equipment',
    fields: {
      soldierId: f('soldier_id', 'text', { ref: 'soldiers', required: true }),
      equipmentTypeId: f('equipment_type_id', 'text', { ref: 'equipmentTypes', required: true }),
      serialNumber: f('serial_number'),
      signedOutDate: f('signed_out_date', 'date'),
      signedInDate: f('signed_in_date', 'date'),
      condition: f('condition', 'enum'),
      notes: f('notes'),
    },
  },

  // ----- Vehicles & operational assignment -----
  departments: {
    table: 'departments',
    route: '/assignments',
    order: 'sort_order, name',
    fields: {
      name: f('name'),
      order: f('sort_order', 'int'),
    },
    dependents: ['tanks'],
  },

  tanks: {
    table: 'tanks',
    route: '/assignments',
    order: 'designation',
    fields: {
      designation: f('designation'),
      type: f('type'),
      vehicleCategory: f('vehicle_category', 'enum'),
      platoonId: f('platoon_id', 'text', { ref: 'platoons' }),
      departmentId: f('department_id', 'text', { ref: 'departments' }),
      status: f('status', 'enum'),
      notes: f('notes'),
    },
    dependents: ['tankCrewAssignments', 'assignments'],
  },

  tankCrewAssignments: {
    table: 'tank_crew_assignments',
    route: '/assignments',
    fields: {
      tankId: f('tank_id', 'text', { ref: 'tanks', required: true }),
      soldierId: f('soldier_id', 'text', { ref: 'soldiers', required: true }),
      role: f('role', 'enum'),
      startDate: f('start_date', 'date'),
      endDate: f('end_date', 'date'),
    },
  },

  shampafEntries: {
    table: 'shampaf_entries',
    route: '/shampaf',
    fields: {
      soldierId: f('soldier_id', 'text', { ref: 'soldiers', required: true }),
      startDateTime: f('start_date_time', 'datetime'),
      endDateTime: f('end_date_time', 'datetime'),
      orderNumber: f('order_number'),
      notes: f('notes'),
    },
    dependents: ['shampafVacations'],
  },

  shampafVacations: {
    table: 'shampaf_vacations',
    route: '/shampaf',
    fields: {
      shampafEntryId: f('shampaf_entry_id', 'text', { ref: 'shampafEntries', required: true }),
      soldierId: f('soldier_id', 'text', { ref: 'soldiers', required: true }),
      type: f('type', 'enum'),
      startDateTime: f('start_date_time', 'datetime'),
      endDateTime: f('end_date_time', 'datetime'),
      reason: f('reason'),
      notes: f('notes'),
    },
  },

  assignments: {
    table: 'assignments',
    route: '/assignments',
    fields: {
      soldierId: f('soldier_id', 'text', { ref: 'soldiers', required: true }),
      type: f('type', 'enum'),
      tankId: f('tank_id', 'text', { ref: 'tanks' }),
      role: f('role', 'enum'),
      missionName: f('mission_name'),
      startDateTime: f('start_date_time', 'datetime'),
      endDateTime: f('end_date_time', 'datetime'),
      notes: f('notes'),
    },
  },

  // ----- Routine -----
  routineDepartments: {
    table: 'routine_departments',
    route: '/routine',
    order: 'sort_order, name',
    fields: {
      name: f('name'),
      order: f('sort_order', 'int'),
    },
    dependents: ['routineVehicles'],
  },

  routineVehicles: {
    table: 'routine_vehicles',
    route: '/routine',
    order: 'designation',
    fields: {
      designation: f('designation'),
      vehicleCategory: f('vehicle_category', 'enum'),
      departmentId: f('department_id', 'text', { ref: 'routineDepartments' }),
    },
    dependents: ['routineTemplates', 'routineChangeLogs'],
  },

  routineTemplates: {
    table: 'routine_templates',
    route: '/routine',
    fields: {
      name: f('name'),
      tankId: f('vehicle_id', 'text', { ref: 'routineVehicles', required: true }),
      notes: f('notes'),
      createdAt: f('created_at', 'ts'),
      updatedAt: f('updated_at', 'ts'),
    },
    children: [
      {
        field: 'crewSlots',
        kind: 'list',
        table: 'routine_crew_slots',
        fk: 'template_id',
        columns: {
          role: f('role', 'enum'),
          soldierId: f('soldier_id', 'text', { ref: 'soldiers', required: true }),
        },
      },
    ],
    dependents: ['routineChangeLogs'],
  },

  routineChangeLogs: {
    table: 'routine_change_logs',
    route: '/routine',
    appendOnly: true,
    order: '"timestamp" DESC',
    fields: {
      templateId: f('template_id'),
      action: f('action', 'enum'),
      role: f('role'),
      soldierId: f('soldier_id'),
      soldierName: f('soldier_name'),
      changedBy: f('changed_by'),
      changedByName: f('changed_by_name'),
      timestamp: f('"timestamp"', 'ts'),
    },
  },

  // ----- Training -----
  trainingContent: {
    table: 'training_content',
    route: '/training',
    order: 'updated_at DESC',
    fields: {
      title: f('title'),
      description: f('description'),
      contentType: f('content_type', 'enum'),
      contentBody: f('content_body'),
      fileUrl: f('file_url'),
      externalUrl: f('external_url'),
      category: f('category'),
      createdBy: f('created_by'),
      createdAt: f('created_at', 'ts'),
      updatedAt: f('updated_at', 'ts'),
    },
    children: [
      { field: 'tags', kind: 'scalarList', table: 'training_content_tags', fk: 'content_id', col: 'tag' },
    ],
  },

  trainingTags: {
    table: 'training_tags',
    route: '/training',
    order: 'name',
    fields: {
      name: f('name'),
      color: f('color'),
    },
  },

  trainingCategories: {
    table: 'training_categories',
    route: '/training',
    order: 'sort_order, name',
    fields: {
      name: f('name'),
      order: f('sort_order', 'int'),
    },
  },

  // ----- Donations -----
  donations: {
    table: 'donations',
    route: '/donations',
    order: 'date DESC',
    fields: {
      donorName: f('donor_name'),
      donorContact: f('donor_contact'),
      donorPhone: f('donor_phone'),
      donorEmail: f('donor_email'),
      type: f('type', 'enum'),
      amount: f('amount', 'num'),
      description: f('description'),
      itemsList: f('items_list'),
      date: f('date', 'date'),
      notes: f('notes'),
      createdAt: f('created_at', 'ts'),
    },
  },

  // ----- Permissions (admin on /permissions) -----
  permissionGroups: {
    table: 'permission_groups',
    route: '/permissions',
    writeLevel: 'admin',
    order: 'name',
    fields: {
      name: f('name'),
      isDefault: f('is_default', 'bool'),
    },
    children: [
      {
        field: 'pagePermissions',
        kind: 'map',
        table: 'group_page_permissions',
        fk: 'group_id',
        keyCol: 'route',
        valueCol: 'action',
      },
    ],
    dependents: ['userPermissions'],
  },

  // A "userPermission" is a row in users plus its group memberships and
  // per-page overrides. google_sub / picture are never written through here.
  userPermissions: {
    table: 'users',
    route: '/permissions',
    writeLevel: 'admin',
    order: 'display_name',
    fields: {
      email: f('email'),
      displayName: f('display_name'),
    },
    children: [
      {
        field: 'groupIds',
        kind: 'scalarList',
        table: 'user_groups',
        fk: 'user_id',
        col: 'group_id',
        ref: 'permissionGroups',
      },
      {
        field: 'customPageOverrides',
        kind: 'map',
        table: 'user_page_overrides',
        fk: 'user_id',
        keyCol: 'route',
        valueCol: 'action',
      },
    ],
  },
};

// Order that satisfies references when inserting from a backup, and the
// collection list the backup file format (version 3) uses.
export const COLLECTION_ORDER = [
  'permissionGroups', 'userPermissions',
  'platoons', 'squads', 'soldiers', 'statusEntries', 'activations',
  'equipmentTypes', 'equipmentAssignments',
  'departments', 'tanks', 'tankCrewAssignments',
  'shampafEntries', 'shampafVacations', 'assignments',
  'routineDepartments', 'routineVehicles', 'routineTemplates', 'routineChangeLogs',
  'trainingCategories', 'trainingTags', 'trainingContent',
  'donations',
];

export function getResource(name) {
  return Object.prototype.hasOwnProperty.call(RESOURCES, name) ? RESOURCES[name] : null;
}
