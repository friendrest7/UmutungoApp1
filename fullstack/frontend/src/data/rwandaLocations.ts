export type RwandaProvince = {
  name: string;
  districts: Record<string, string[]>;
};

// MVP location catalogue. Kigali sectors are complete for the current launch market;
// the remaining districts are included so the form follows Rwanda's hierarchy and
// can be extended from the official boundary dataset without changing its contract.
export const rwandaLocations: RwandaProvince[] = [
  {
    name: 'City of Kigali',
    districts: {
      Gasabo: ['Bumbogo', 'Gatsata', 'Gikomero', 'Gisozi', 'Jabana', 'Jali', 'Kacyiru', 'Kimihurura', 'Kimironko', 'Kinyinya', 'Ndera', 'Nduba', 'Remera', 'Rusororo', 'Rutunga'],
      Kicukiro: ['Gahanga', 'Gatenga', 'Gikondo', 'Kagarama', 'Kanombe', 'Kicukiro', 'Kigarama', 'Masaka', 'Niboye', 'Nyarugunga'],
      Nyarugenge: ['Gitega', 'Kigali', 'Kimisagara', 'Mageragere', 'Muhima', 'Nyakabanda', 'Nyamirambo', 'Nyarugenge', 'Rwezamenyo'],
    },
  },
  { name: 'Eastern Province', districts: { Bugesera: [], Gatsibo: [], Kayonza: [], Kirehe: [], Ngoma: [], Nyagatare: [], Rwamagana: [] } },
  { name: 'Northern Province', districts: { Burera: [], Gakenke: [], Gicumbi: [], Musanze: [], Rulindo: [] } },
  { name: 'Southern Province', districts: { Gisagara: [], Huye: [], Kamonyi: [], Muhanga: [], Nyamagabe: [], Nyanza: [], Nyaruguru: [], Ruhango: [] } },
  { name: 'Western Province', districts: { Karongi: [], Ngororero: [], Nyabihu: [], Nyamasheke: [], Rubavu: [], Rusizi: [], Rutsiro: [] } },
];

export const provinceNames = rwandaLocations.map((province) => province.name);

export function getProvince(name: string) {
  return rwandaLocations.find((province) => province.name === name);
}

export function getDistrictNames(provinceName: string) {
  return Object.keys(getProvince(provinceName)?.districts ?? {});
}

export function getSectorNames(provinceName: string, districtName: string) {
  return getProvince(provinceName)?.districts[districtName] ?? [];
}
