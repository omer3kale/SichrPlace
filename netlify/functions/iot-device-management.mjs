export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const iotData = {
      timestamp: new Date().toISOString(),
      iot_status: 'operational',
      connected_devices: {
        smart_locks: 156,
        temperature_sensors: 234,
        security_cameras: 89,
        smoke_detectors: 178,
        energy_meters: 123,
        air_quality_sensors: 67
      },
      device_health: {
        online_devices: 835,
        offline_devices: 12,
        battery_low: 8,
        firmware_updates_pending: 23,
        connectivity_status: '98.6%'
      },
      sensor_data: {
        avg_temperature: 21.5,
        avg_humidity: 45.2,
        air_quality_index: 85,
        energy_consumption: '125 kWh/day',
        security_alerts: 0
      },
      automation_rules: [
        {
          rule_id: 'auto_lighting',
          trigger: 'motion_detected',
          action: 'turn_on_lights',
          active_properties: 45
        },
        {
          rule_id: 'energy_optimization',
          trigger: 'no_occupancy_2h',
          action: 'reduce_heating_cooling',
          active_properties: 67
        },
        {
          rule_id: 'security_alert',
          trigger: 'unauthorized_access',
          action: 'notify_owner_and_security',
          active_properties: 89
        }
      ]
    };

    if (event.httpMethod === 'POST') {
      const { action, iot_config } = JSON.parse(event.body || '{}');
      
      switch (action) {
        case 'register_device':
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              success: true,
              device_id: `device_${Date.now()}`,
              device_type: iot_config.device_type,
              property_id: iot_config.property_id,
              activation_code: Math.random().toString(36).substr(2, 8).toUpperCase()
            })
          };
          
        case 'get_sensor_data':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              device_id: iot_config.device_id,
              current_reading: {
                value: Math.random() * 100,
                unit: iot_config.unit || 'unknown',
                timestamp: new Date().toISOString()
              },
              status: 'online'
            })
          };
          
        case 'send_command':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              command_id: `cmd_${Date.now()}`,
              device_id: iot_config.device_id,
              command: iot_config.command,
              execution_status: 'sent',
              estimated_execution: '5-10 seconds'
            })
          };
          
        case 'create_automation':
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              success: true,
              automation_id: `auto_${Date.now()}`,
              trigger: iot_config.trigger,
              action: iot_config.action,
              status: 'active'
            })
          };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: iotData,
        message: 'IoT device management data retrieved'
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'IoT device management failed',
        message: error.message
      })
    };
  }
};