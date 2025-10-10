-- Seed 20 buses with depot details across Uttarakhand
-- Assumes comprehensive buses schema migration has run (depo, category, etc.)

insert into public.buses (
  bus_number,
  route_name,
  status,
  start_point,
  end_point,
  depo,
  category,
  sitting_capacity,
  running_hours,
  bus_type
) values
  ('UK-01-A-1001', 'Rajpur Road Loop', 'active', 'Clock Tower', 'Rajpur', 'Dehradun Depot', 'big_bus', 64, 15, 'non_ac'),
  ('UK-01-A-1002', 'ISBT - Mussoorie', 'active', 'ISBT', 'Mussoorie', 'Dehradun Depot', 'big_bus', 64, 12, 'ac'),
  ('UK-08-B-2001', 'Har-ki-Pauri Shuttle', 'active', 'Railway Station', 'Har-ki-Pauri', 'Haridwar Depot', 'small_bus', 32, 15, 'non_ac'),
  ('UK-08-B-2002', 'BHEL - City Loop', 'maintenance', 'BHEL', 'City Bus Stand', 'Haridwar Depot', 'big_bus', 64, 12, 'non_ac'),
  ('UK-14-C-3001', 'AIIMS - Rishikesh Loop', 'active', 'AIIMS', 'Triveni Ghat', 'Rishikesh Depot', 'small_bus', 32, 15, 'non_ac'),
  ('UK-14-C-3002', 'Dehradun - Rishikesh', 'active', 'ISBT Dehradun', 'Rishikesh Bus Stand', 'Rishikesh Depot', 'big_bus', 64, 12, 'ac'),
  ('UK-06-D-4001', 'Roorkee City Express', 'offline', 'Civil Lines', 'Bus Stand', 'Roorkee Depot', 'small_bus', 32, 12, 'non_ac'),
  ('UK-06-D-4002', 'Roorkee - Haridwar', 'active', 'Roorkee', 'Haridwar', 'Roorkee Depot', 'big_bus', 64, 12, 'non_ac'),
  ('UK-04-E-5001', 'Haldwani - Kathgodam', 'active', 'Haldwani', 'Kathgodam', 'Haldwani Depot', 'small_bus', 40, 12, 'non_ac'),
  ('UK-04-E-5002', 'Haldwani City Loop', 'maintenance', 'Mandi', 'Bus Stand', 'Haldwani Depot', 'big_bus', 64, 12, 'non_ac'),
  ('UK-04-F-6001', 'Nainital Mall Road Shuttle', 'active', 'Tallital', 'Mall Road', 'Nainital Depot', 'small_bus', 28, 12, 'non_ac'),
  ('UK-04-F-6002', 'Nainital - Bhimtal', 'active', 'Nainital', 'Bhimtal', 'Nainital Depot', 'small_bus', 32, 12, 'non_ac'),
  ('UK-01-G-7001', 'Almora - Ranikhet', 'active', 'Almora', 'Ranikhet', 'Almora Depot', 'big_bus', 48, 12, 'non_ac'),
  ('UK-01-G-7002', 'Almora City Service', 'offline', 'Bus Stand', 'Market', 'Almora Depot', 'small_bus', 28, 12, 'non_ac'),
  ('UK-05-H-8001', 'Pithoragarh - Champawat', 'active', 'Pithoragarh', 'Champawat', 'Pithoragarh Depot', 'big_bus', 48, 12, 'non_ac'),
  ('UK-05-H-8002', 'Pithoragarh City Loop', 'active', 'Airport Road', 'Bus Stand', 'Pithoragarh Depot', 'small_bus', 28, 12, 'non_ac'),
  ('UK-06-I-9001', 'Rudrapur - Kashipur', 'active', 'Rudrapur', 'Kashipur', 'Rudrapur Depot', 'big_bus', 64, 12, 'ac'),
  ('UK-06-I-9002', 'Rudrapur City Express', 'maintenance', 'Industrial Area', 'Bus Stand', 'Rudrapur Depot', 'big_bus', 64, 12, 'non_ac'),
  ('UK-06-J-9101', 'Kashipur City Service', 'active', 'Bazpur Road', 'Railway Station', 'Kashipur Depot', 'small_bus', 32, 12, 'non_ac'),
  ('UK-06-J-9102', 'Kashipur - Jaspur', 'active', 'Kashipur', 'Jaspur', 'Kashipur Depot', 'big_bus', 48, 12, 'non_ac');


