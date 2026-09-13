import ExcelJS from 'exceljs'

// One sheet per entity, columns matching the field names already used
// throughout src/services/api.js and the *.mjs route toApi() shapes — kept
// in sync with those by hand since there's no shared schema to derive from.
const SHEETS = [
  { name: 'Repairs', key: 'repairs', columns: [
    { header: 'ID', key: 'id' }, { header: 'Reference #', key: 'referenceNumber' },
    { header: 'Model', key: 'model' }, { header: 'Date Received', key: 'dateReceived' },
    { header: 'School', key: 'schoolName' }, { header: 'Received By', key: 'receivedBy' },
    { header: 'Problem', key: 'problemIdentified' }, { header: 'Status', key: 'status' },
    { header: 'Technician', key: 'technician' }, { header: 'Date Repaired', key: 'dateRepaired' },
    { header: 'Picked Up By', key: 'pickedUpBy' }, { header: 'Date Returned', key: 'dateReturnedToSchool' },
    { header: 'Remarks', key: 'remarks' }, { header: 'Laptop ID #', key: 'laptopIdNumber' },
  ]},
  { name: 'Spare Laptops', key: 'laptops', columns: [
    { header: 'ID', key: 'id' }, { header: 'ID Number', key: 'idNumber' },
    { header: 'Manufacturer', key: 'manufacturer' }, { header: 'Model', key: 'model' },
    { header: 'CPU', key: 'cpu' }, { header: 'CPU Class', key: 'cpuClass' },
    { header: 'Memory/HD', key: 'memHd' }, { header: 'Comments', key: 'comments' },
    { header: 'Location', key: 'location' }, { header: 'Donor', key: 'donor' }, { header: 'Date', key: 'date' },
  ]},
  { name: 'Schools', key: 'schools', columns: [
    { header: 'ID', key: 'id' }, { header: 'Name', key: 'name' }, { header: 'District', key: 'district' },
    { header: 'Region', key: 'region' }, { header: 'Status', key: 'status' }, { header: 'Laptop Count', key: 'laptopCount' },
    { header: 'Activated', key: 'activatedDate' }, { header: 'Deactivated', key: 'deactivatedDate' },
    { header: 'Deactivated Reason', key: 'deactivatedReason' }, { header: 'Notes', key: 'notes' },
  ]},
  { name: 'Warehouse Inventory', key: 'inventory', columns: [
    { header: 'ID', key: 'id' }, { header: 'Box', key: 'boxName' }, { header: 'Item', key: 'item' },
    { header: 'Quantity', key: 'quantity' }, { header: 'Description', key: 'description' }, { header: 'Last Updated', key: 'lastUpdated' },
  ]},
  { name: 'Withdrawals', key: 'withdrawals', columns: [
    { header: 'ID', key: 'id' }, { header: 'Date', key: 'date' }, { header: 'Box', key: 'boxName' },
    { header: 'Item', key: 'item' }, { header: 'Qty Taken', key: 'quantityTaken' }, { header: 'Remaining', key: 'remainingQty' },
    { header: 'Taken By', key: 'takenBy' }, { header: 'Destination', key: 'destination' }, { header: 'Notes', key: 'notes' },
  ]},
  { name: 'Deployments', key: 'deployments', columns: [
    { header: 'ID', key: 'id' }, { header: 'Date', key: 'date' }, { header: 'Laptop ID #', key: 'idNumber' },
    { header: 'Action', key: 'action' }, { header: 'School', key: 'school' }, { header: 'Taken By', key: 'takenBy' }, { header: 'Notes', key: 'notes' },
  ]},
  { name: 'Users', key: 'users', columns: [
    { header: 'ID', key: 'id' }, { header: 'Email', key: 'email' }, { header: 'Name', key: 'name' },
    { header: 'Role', key: 'role' }, { header: 'School', key: 'schoolName' }, { header: 'Added', key: 'addedDate' },
  ]},
  { name: 'Deleted Log', key: 'deletedLog', columns: [
    { header: 'ID', key: 'id' }, { header: 'When', key: 'timestamp' }, { header: 'Deleted By', key: 'deletedBy' },
    { header: 'Type', key: 'type' }, { header: 'Box', key: 'boxName' }, { header: 'Item', key: 'item' },
    { header: 'Quantity', key: 'quantity' }, { header: 'Description', key: 'description' },
  ]},
]

// `collections` = { repairs, laptops, schools, inventory, withdrawals, deployments, users, deletedLog }
// (each a plain array, same field names as the app already uses). Triggers
// a browser download of a single multi-sheet .xlsx — no server round trip
// beyond the same GET endpoints the app already calls.
export async function exportBackupToExcel(collections) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Reneal Warehouse System'
  workbook.created = new Date()

  for (const sheetDef of SHEETS) {
    const sheet = workbook.addWorksheet(sheetDef.name)
    sheet.columns = sheetDef.columns
    sheet.getRow(1).font = { bold: true }
    for (const row of collections[sheetDef.key] || []) sheet.addRow(row)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reneal-warehouse-backup-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
