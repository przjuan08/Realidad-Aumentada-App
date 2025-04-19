"use client"

// Importaciones necesarias
import { useState, useEffect } from "react"
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native"
import * as Location from "expo-location"
import { obtenerDatosMeteorologicos } from "../services/api"

const HomeScreen = ({ navigation }) => {
  // Estados para manejar los datos y la UI
  const [datosMeteo, setDatosMeteo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [ubicacion, setUbicacion] = useState(null)

  // Función para solicitar permisos de ubicación
  const solicitarPermisos = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        setError("Se requiere permiso de ubicación para mostrar datos meteorológicos locales")
        return false
      }
      return true
    } catch (err) {
      console.error("Error al solicitar permisos:", err)
      setError("No se pudieron solicitar permisos de ubicación")
      return false
    }
  }

  // Función para obtener la ubicación actual
  const obtenerUbicacion = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      console.log("Ubicación obtenida:", location.coords)
      setUbicacion(location)
      return location
    } catch (err) {
      console.error("Error al obtener ubicación:", err)
      setError("No se pudo obtener tu ubicación actual")
      return null
    }
  }

  // Función para cargar los datos meteorológicos
  const cargarDatosMeteorologicos = async () => {
    try {
      setCargando(true)
      setError(null)

      // Verificar permisos primero
      const tienePermisos = await solicitarPermisos()
      if (!tienePermisos) {
        setCargando(false)
        return
      }

      // Obtener ubicación
      const location = await obtenerUbicacion()
      if (!location) {
        setCargando(false)
        return
      }

      // Obtener datos meteorológicos
      const datos = await obtenerDatosMeteorologicos(location.coords.latitude, location.coords.longitude)

      console.log("Datos meteorológicos obtenidos:", datos)
      setDatosMeteo(datos)
    } catch (err) {
      console.error("Error al cargar datos meteorológicos:", err)
      setError("No se pudieron cargar los datos meteorológicos: " + err.message)
      Alert.alert("Error", "No se pudieron cargar los datos meteorológicos")
    } finally {
      setCargando(false)
    }
  }

  // Cargar datos al iniciar la pantalla
  useEffect(() => {
    cargarDatosMeteorologicos()
  }, [])

  // Función para ir a la pantalla AR
  const irAPantallaAR = () => {
    if (!datosMeteo || !ubicacion) {
      Alert.alert("Error", "Espera a que se carguen los datos meteorológicos")
      return
    }
    navigation.navigate("AR", {
      datosMeteo: datosMeteo,
      ubicacion: ubicacion,
    })
  }

  // Renderizar la interfaz de usuario
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Datos Meteorológicos</Text>
        <Text style={styles.subtitulo}>En tiempo real</Text>
      </View>

      {/* Botón para actualizar manualmente */}
      <TouchableOpacity style={styles.botonActualizar} onPress={cargarDatosMeteorologicos}>
        <Text style={styles.botonTexto}>Actualizar Datos</Text>
      </TouchableOpacity>

      {/* Mostrar indicador de carga, error o datos */}
      {cargando ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Cargando datos meteorológicos...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.botonReintentar} onPress={cargarDatosMeteorologicos}>
            <Text style={styles.botonTexto}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : datosMeteo ? (
        <View style={styles.datosContainer}>
          {/* Tarjeta de ubicación */}
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaTitulo}>Ubicación</Text>
            <Text style={styles.ubicacionTexto}>{datosMeteo.nombreUbicacion}</Text>
            {ubicacion && (
              <Text style={styles.coordsTexto}>
                Lat: {ubicacion.coords.latitude.toFixed(4)}, Lon: {ubicacion.coords.longitude.toFixed(4)}
              </Text>
            )}
          </View>

          {/* Tarjeta de temperatura */}
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaTitulo}>Temperatura</Text>
            <View style={styles.datoRow}>
              <Text style={styles.temperaturaTexto}>{datosMeteo.temperatura}°C</Text>
              <View style={styles.datoInfo}>
                <Text style={styles.datoLabel}>Sensación térmica</Text>
                <Text style={styles.datoValor}>{datosMeteo.sensacionTermica}°C</Text>
              </View>
            </View>
            <View style={styles.minMaxContainer}>
              <Text style={styles.minMaxTexto}>
                Min: {datosMeteo.temperaturaMin}°C | Max: {datosMeteo.temperaturaMax}°C
              </Text>
            </View>
          </View>

          {/* Tarjeta de condiciones */}
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaTitulo}>Condiciones</Text>
            <View style={styles.condicionesRow}>
              <View style={styles.condicionIcono}>
                {/* Aquí iría un icono según la condición */}
                <Text style={styles.condicionEmoji}>{obtenerEmojiClima(datosMeteo.condicion)}</Text>
              </View>
              <View style={styles.condicionInfo}>
                <Text style={styles.condicionTexto}>{datosMeteo.condicion}</Text>
                <Text style={styles.condicionDesc}>{datosMeteo.descripcion}</Text>
              </View>
            </View>
          </View>

          {/* Tarjeta de humedad y viento */}
          <View style={styles.tarjetasRow}>
            <View style={[styles.tarjeta, styles.tarjetaMitad]}>
              <Text style={styles.tarjetaTitulo}>Humedad</Text>
              <Text style={styles.humedadTexto}>{datosMeteo.humedad}%</Text>
            </View>
            <View style={[styles.tarjeta, styles.tarjetaMitad]}>
              <Text style={styles.tarjetaTitulo}>Viento</Text>
              <Text style={styles.vientoTexto}>{datosMeteo.viento} km/h</Text>
              <Text style={styles.vientoDir}>Dirección: {datosMeteo.direccionViento}°</Text>
            </View>
          </View>

          {/* Botón para ver en AR */}
          <TouchableOpacity style={styles.botonAR} onPress={irAPantallaAR}>
            <Text style={styles.botonARTexto}>Ver en Realidad Aumentada</Text>
          </TouchableOpacity>

          {/* Información de actualización */}
          <Text style={styles.actualizacionTexto}>Última actualización: {new Date().toLocaleTimeString()}</Text>
        </View>
      ) : (
        <Text style={styles.noDataText}>No hay datos disponibles</Text>
      )}
    </ScrollView>
  )
}

// Función para obtener emoji según condición climática
const obtenerEmojiClima = (condicion) => {
  const condicionLower = condicion.toLowerCase()
  if (condicionLower.includes("lluvia") || condicionLower.includes("rain")) return "🌧️"
  if (condicionLower.includes("nube") || condicionLower.includes("cloud")) return "☁️"
  if (condicionLower.includes("sol") || condicionLower.includes("clear")) return "☀️"
  if (condicionLower.includes("nieve") || condicionLower.includes("snow")) return "❄️"
  if (condicionLower.includes("tormenta") || condicionLower.includes("thunder")) return "⛈️"
  if (condicionLower.includes("niebla") || condicionLower.includes("fog")) return "🌫️"
  return "🌤️" // Valor por defecto
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 20,
    backgroundColor: "#0066CC",
    alignItems: "center",
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 5,
  },
  subtitulo: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
  },
  botonActualizar: {
    backgroundColor: "#0066CC",
    padding: 15,
    borderRadius: 8,
    margin: 15,
    alignItems: "center",
  },
  botonTexto: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  loadingContainer: {
    padding: 30,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 15,
    fontSize: 16,
  },
  botonReintentar: {
    backgroundColor: "#0066CC",
    padding: 12,
    borderRadius: 8,
    width: 150,
    alignItems: "center",
  },
  datosContainer: {
    padding: 15,
  },
  tarjeta: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tarjetaTitulo: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  ubicacionTexto: {
    fontSize: 20,
    marginBottom: 5,
  },
  coordsTexto: {
    fontSize: 14,
    color: "#666",
  },
  datoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  temperaturaTexto: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FF5733",
  },
  datoInfo: {
    alignItems: "flex-end",
  },
  datoLabel: {
    fontSize: 14,
    color: "#666",
  },
  datoValor: {
    fontSize: 18,
    fontWeight: "bold",
  },
  minMaxContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  minMaxTexto: {
    fontSize: 14,
    color: "#666",
  },
  condicionesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  condicionIcono: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  condicionEmoji: {
    fontSize: 40,
  },
  condicionInfo: {
    flex: 1,
  },
  condicionTexto: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },
  condicionDesc: {
    fontSize: 16,
    color: "#666",
  },
  tarjetasRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tarjetaMitad: {
    width: "48%",
  },
  humedadTexto: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#33A1FF",
  },
  vientoTexto: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#666",
  },
  vientoDir: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  botonAR: {
    backgroundColor: "#009933",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 15,
  },
  botonARTexto: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  actualizacionTexto: {
    textAlign: "center",
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  noDataText: {
    textAlign: "center",
    fontSize: 18,
    color: "#666",
    padding: 30,
  },
})

export default HomeScreen
