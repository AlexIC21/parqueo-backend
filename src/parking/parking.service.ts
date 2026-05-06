import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ParkingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAvailability() {
    const result = await this.databaseService.query(`
      SELECT
        autos_capacity,
        autos_occupied,
        autos_capacity - autos_occupied AS autos_available,
        motos_capacity,
        motos_occupied,
        motos_capacity - motos_occupied AS motos_available
      FROM parking_counter
      WHERE parking_lot_id = 1;
    `);

    const data = result.rows[0];

    return {
      autosCapacity: data.autos_capacity,
      autosOccupied: data.autos_occupied,
      autosAvailable: data.autos_available,
      motosCapacity: data.motos_capacity,
      motosOccupied: data.motos_occupied,
      motosAvailable: data.motos_available,
    };
  }
async getMapStatus() {
  const result = await this.databaseService.query(`
    SELECT
      code AS space_code,
      COALESCE(svg_element_id, code) AS svg_element_id,
      vehicle_type,
      status
    FROM parking_spaces
    ORDER BY vehicle_type, sort_number;
  `);

  return {
    spaces: result.rows.map((row) => ({
      spaceCode: row.space_code,
      svgElementId: row.svg_element_id,
      vehicleType: row.vehicle_type,
      status: row.status,
    })),
  };
}
}

