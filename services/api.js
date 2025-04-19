// Importaciones necesarias
import axios from "axios"

// URL para la API Open-Meteo (no requiere autenticación)
const OPEN_METEO_API_URL = "https://api.open-meteo.com/v1/forecast"

// URL para la API de geocodificación inversa (para obtener nombres de ubicaciones)
const GEOCODING_API_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"

/**
 * Función para obtener el nombre de la ubicación basado en coordenadas
 * @param {number} latitude - Latitud
 * @param {number} longitude - Longitud
 * @returns {Promise<string>} - Nombre de la ubicación
 */
const obtenerNombreUbicacion = async (latitude, longitude) => {
  try {
    console.log(`Obteniendo nombre de ubicación para: ${latitude}, ${longitude}`)

    // Llamar a la API de geocodificación inversa
    const response = await axios.get(GEOCODING_API_URL, {
      params: {
        latitude,
        longitude,
        localityLanguage: "es", // Solicitar resultados en español
      },
    })

    console.log("Respuesta de geocodificación:", response.data)

    // Construir nombre de ubicación con los datos disponibles
    const { locality, city, principalSubdivision, countryName } = response.data

    // Intentar usar la localidad o ciudad primero
    if (locality) {
      return `${locality}, ${countryName}`
    } else if (city) {
      return `${city}, ${countryName}`
    } else if (principalSubdivision) {
      return `${principalSubdivision}, ${countryName}`
    } else {
      return countryName || "Ubicación desconocida"
    }
  } catch (error) {
    console.error("Error al obtener nombre de ubicación:", error)
    // En caso de error, devolver un nombre genérico con las coordenadas
    return `Ubicación (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`
  }
}

/**
 * Función para obtener datos meteorológicos basados en coordenadas
 * @param {number} latitude - Latitud
 * @param {number} longitude - Longitud
 * @returns {Promise<Object>} - Datos meteorológicos
 */
export const obtenerDatosMeteorologicos = async (latitude, longitude) => {
  try {
    console.log(`Consultando API meteorológica en ${latitude}, ${longitude}`)

    // Obtener nombre de ubicación en paralelo
    const nombreUbicacionPromise = obtenerNombreUbicacion(latitude, longitude)

    // Llamar a la API Open-Meteo
    const response = await axios.get(OPEN_METEO_API_URL, {
      params: {
        latitude,
        longitude,
        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m",
        daily: "temperature_2m_max,temperature_2m_min",
        timezone: "auto",
        forecast_days: 1,
        language: "es", // Solicitar descripciones en español
      },
    })

    console.log("Respuesta de la API meteorológica:", response.data)

    // Extraer datos relevantes
    const { current, daily } = response.data

    // Obtener condición climática basada en el código del tiempo
    const { condicion, descripcion } = obtenerCondicionClimatica(current.weather_code)

    // Esperar a que se resuelva la promesa del nombre de ubicación
    const nombreUbicacion = await nombreUbicacionPromise

    // Construir y devolver objeto con datos meteorológicos
    return {
      temperatura: Math.round(current.temperature_2m * 10) / 10, // Redondear a 1 decimal
      sensacionTermica: Math.round(current.apparent_temperature * 10) / 10,
      humedad: current.relative_humidity_2m,
      viento: Math.round(current.wind_speed_10m * 10) / 10,
      direccionViento: current.wind_direction_10m,
      condicion: condicion,
      descripcion: descripcion,
      temperaturaMax: Math.round(daily.temperature_2m_max[0] * 10) / 10,
      temperaturaMin: Math.round(daily.temperature_2m_min[0] * 10) / 10,
      nombreUbicacion: nombreUbicacion,
      ultimaActualizacion: new Date().toISOString(),
    }
  } catch (error) {
    console.error("Error al obtener datos meteorológicos:", error)
    // Lanzar el error para manejarlo en el componente
    throw new Error("No se pudieron obtener los datos meteorológicos: " + error.message)
  }
}

/**
 * Función para obtener la condición climática y descripción basada en el código del tiempo
 * @param {number} weatherCode - Código del tiempo según Open-Meteo
 * @returns {Object} - Objeto con condición y descripción
 */
const obtenerCondicionClimatica = (weatherCode) => {
  // Mapeo de códigos de tiempo a condiciones y descripciones
  // Basado en la documentación de Open-Meteo: https://open-meteo.com/en/docs
  const condiciones = {
    0: { condicion: "Despejado", descripcion: "Cielo despejado" },
    1: { condicion: "Mayormente despejado", descripcion: "Principalmente despejado" },
    2: { condicion: "Parcialmente nublado", descripcion: "Parcialmente nublado" },
    3: { condicion: "Nublado", descripcion: "Cielo cubierto" },
    45: { condicion: "Niebla", descripcion: "Niebla" },
    48: { condicion: "Niebla helada", descripcion: "Niebla con escarcha" },
    51: { condicion: "Llovizna ligera", descripcion: "Llovizna ligera" },
    53: { condicion: "Llovizna moderada", descripcion: "Llovizna moderada" },
    55: { condicion: "Llovizna intensa", descripcion: "Llovizna densa" },
    56: { condicion: "Llovizna helada", descripcion: "Llovizna helada ligera" },
    57: { condicion: "Llovizna helada", descripcion: "Llovizna helada densa" },
    61: { condicion: "Lluvia ligera", descripcion: "Lluvia ligera" },
    63: { condicion: "Lluvia moderada", descripcion: "Lluvia moderada" },
    65: { condicion: "Lluvia intensa", descripcion: "Lluvia intensa" },
    66: { condicion: "Lluvia helada", descripcion: "Lluvia helada ligera" },
    67: { condicion: "Lluvia helada", descripcion: "Lluvia helada intensa" },
    71: { condicion: "Nieve ligera", descripcion: "Nevada ligera" },
    73: { condicion: "Nieve moderada", descripcion: "Nevada moderada" },
    75: { condicion: "Nieve intensa", descripcion: "Nevada intensa" },
    77: { condicion: "Granos de nieve", descripcion: "Granos de nieve" },
    80: { condicion: "Lluvia ligera", descripcion: "Chubascos ligeros" },
    81: { condicion: "Lluvia moderada", descripcion: "Chubascos moderados" },
    82: { condicion: "Lluvia intensa", descripcion: "Chubascos violentos" },
    85: { condicion: "Nieve ligera", descripcion: "Chubascos de nieve ligeros" },
    86: { condicion: "Nieve intensa", descripcion: "Chubascos de nieve intensos" },
    95: { condicion: "Tormenta", descripcion: "Tormenta eléctrica" },
    96: { condicion: "Tormenta con granizo", descripcion: "Tormenta con granizo ligero" },
    99: { condicion: "Tormenta con granizo", descripcion: "Tormenta con granizo intenso" },
  }

  // Devolver la condición correspondiente o una por defecto si no se encuentra
  return condiciones[weatherCode] || { condicion: "Desconocido", descripcion: "Condición meteorológica desconocida" }
}
