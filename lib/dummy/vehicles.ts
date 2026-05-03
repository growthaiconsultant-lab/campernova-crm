export type DummyVehicle = {
  id: string
  title: string
  year: number
  km: number
  seats: number
  sleeps: number
  fuel: string
  transmission: string
  type: 'Camper' | 'Autocaravana'
  price: number
  location: string
  tags: string[]
  highlight: string
  placeholder: string
}

export const DUMMY_VEHICLES: DummyVehicle[] = [
  {
    id: 'vw-cali-coast',
    title: 'Volkswagen California Coast',
    year: 2022,
    km: 38500,
    seats: 4,
    sleeps: 4,
    fuel: 'Diesel',
    transmission: 'Automático',
    type: 'Camper',
    price: 64900,
    location: 'Madrid',
    tags: ['Revisada', 'Ideal parejas'],
    highlight:
      'Una camper compacta y polivalente, perfecta para descubrir Europa sin renunciar a la comodidad del día a día.',
    placeholder: 'VW California — exterior',
  },
  {
    id: 'fiat-ducato-globe',
    title: 'Fiat Ducato Globe-Traveller',
    year: 2021,
    km: 52100,
    seats: 4,
    sleeps: 4,
    fuel: 'Diesel',
    transmission: 'Manual',
    type: 'Autocaravana',
    price: 58500,
    location: 'Barcelona',
    tags: ['Nueva entrada', 'Ideal familia'],
    highlight:
      'Camperizada artesanalmente con maderas claras y baño completo. Lista para largas estancias.',
    placeholder: 'Ducato — interior + exterior',
  },
  {
    id: 'mercedes-marco-polo',
    title: 'Mercedes-Benz Marco Polo',
    year: 2023,
    km: 21900,
    seats: 4,
    sleeps: 4,
    fuel: 'Diesel',
    transmission: 'Automático',
    type: 'Camper',
    price: 79500,
    location: 'Valencia',
    tags: ['Premium', 'Revisada'],
    highlight: 'Acabados de gama alta, techo elevable eléctrico y todos los extras de fábrica.',
    placeholder: 'Marco Polo — frontal',
  },
  {
    id: 'renault-trafic-spaceclass',
    title: 'Renault Trafic SpaceClass',
    year: 2020,
    km: 71200,
    seats: 5,
    sleeps: 2,
    fuel: 'Diesel',
    transmission: 'Manual',
    type: 'Camper',
    price: 32400,
    location: 'Sevilla',
    tags: ['Buen precio'],
    highlight:
      'Una entrada al mundo camper sensata y fiable. Perfecta para escapadas de fin de semana.',
    placeholder: 'Renault Trafic — lateral',
  },
  {
    id: 'ford-transit-nugget',
    title: 'Ford Transit Nugget',
    year: 2022,
    km: 44600,
    seats: 4,
    sleeps: 4,
    fuel: 'Diesel',
    transmission: 'Automático',
    type: 'Camper',
    price: 56900,
    location: 'Bilbao',
    tags: ['Revisada', 'Ideal parejas'],
    highlight: 'Cocina amplia con módulo Westfalia, calefacción estacionaria y techo elevable.',
    placeholder: 'Ford Nugget — campsite',
  },
  {
    id: 'knaus-boxstar',
    title: 'Knaus Boxstar 600 Lifetime',
    year: 2023,
    km: 12400,
    seats: 4,
    sleeps: 2,
    fuel: 'Diesel',
    transmission: 'Manual',
    type: 'Autocaravana',
    price: 71500,
    location: 'Madrid',
    tags: ['Casi nueva', 'Premium'],
    highlight:
      'Furgoneta camper de gama alta, cama transversal y baño separado con plato de ducha.',
    placeholder: 'Knaus Boxstar — exterior',
  },
]
