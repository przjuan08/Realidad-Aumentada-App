"use client"

// Importaciones necesarias
import { useState, useEffect, useRef, useCallback } from "react"
import { StyleSheet, View, Text, TouchableOpacity, Alert, Dimensions, Platform, Animated } from "react-native"
import { CameraView, useCameraPermissions } from "expo-camera"
import { Accelerometer } from "expo-sensors"
import * as Linking from "expo-linking"
import { obtenerDatosMeteorologicos } from "../services/api"
import { BlurView } from "expo-blur"
import * as Haptics from "expo-haptics"
import { DeviceMotion } from "expo-sensors"

// Componente principal de la pantalla AR
const ARScreen = ({ route, navigation }) => {
  // Obtener datos pasados desde la pantalla anterior
  const { datosMeteo: datosIniciales, ubicacion: ubicacionInicial } = route.params

  // Estados para manejar los datos y la UI
  const [datosMeteo, setDatosMeteo] = useState(datosIniciales)
  const [cargando, setCargando] = useState(false)
  const [ubicacion, setUbicacion] = useState(ubicacionInicial)

  // Valores animados para movimientos más fluidos
  const panelOpacity = useRef(new Animated.Value(0)).current
  const panelScale = useRef(new Animated.Value(0.9)).current
  const panelTranslateX = useRef(new Animated.Value(0)).current
  const panelTranslateY = useRef(new Animated.Value(0)).current
  const panelRotateX = useRef(new Animated.Value(0)).current
  const panelRotateY = useRef(new Animated.Value(0)).current

  // Estado para la distancia de profundidad simulada
  const [depthFactor, setDepthFactor] = useState(1)

  // Estado para controlar si el panel debe ser visible basado en la orientación
  const [isPanelInView, setIsPanelInView] = useState(true)

  // Referencia para la orientación "ancla" donde el panel debe aparecer
  const [anchorOrientation, setAnchorOrientation] = useState(null)

  // Estado para almacenar la orientación actual del dispositivo
  const [currentOrientation, setCurrentOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 })

  const cameraRef = useRef(null)
  const datosMeteoRef = useRef(datosIniciales) // Referencia para evitar re-renders
  const [permisoCamera, requestPermisoCamera] = useCameraPermissions()

  // Referencia para controlar si los datos se están actualizando
  const isUpdatingData = useRef(false)

  // Referencia para el intervalo de actualización
  const updateIntervalRef = useRef(null)

  // Solicitar permisos de cámara
  useEffect(() => {
    ;(async () => {
      if (!permisoCamera) {
        await requestPermisoCamera()
      }
    })()
  }, [])

  // Efecto de aparición al montar el componente
  useEffect(() => {
    if (permisoCamera?.granted) {
      // Animación de entrada
      Animated.parallel([
        Animated.timing(panelOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(panelScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start()

      // Feedback háptico al mostrar el panel
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      } catch (error) {
        console.log("Haptics no disponible:", error)
      }
    }

    // Limpiar al desmontar
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [permisoCamera?.granted])

  // Función para establecer la posición actual como ancla
  const setCurrentPositionAsAnchor = () => {
    setAnchorOrientation({ ...currentOrientation })
    setIsPanelInView(true) // Asegurar que el panel sea visible inicialmente

    // Feedback háptico al establecer ancla
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      console.log("Haptics no disponible:", error)
    }

    Alert.alert("Posición Anclada", "El panel se mostrará en esta posición cuando mires aquí.")
  }

  // Función para determinar si el panel debe ser visible basado en la orientación
  const checkIfPanelInView = useCallback((current, anchor) => {
    if (!anchor) return true // Si no hay ancla, siempre mostrar

    // Calcular la diferencia entre la orientación actual y la ancla
    const betaDiff = Math.abs(current.beta - anchor.beta)
    const gammaDiff = Math.abs(current.gamma - anchor.gamma)

    // Umbral de tolerancia en grados (cuánto puede desviarse antes de que desaparezca)
    const threshold = 20 // Aumentado para mayor tolerancia

    // El panel está en vista si la diferencia está dentro del umbral
    return betaDiff < threshold && gammaDiff < threshold
  }, [])

  // Función para actualizar la visibilidad del panel con animación
  const updatePanelVisibility = useCallback(
    (shouldBeVisible) => {
      if (!shouldBeVisible && panelOpacity._value > 0) {
        Animated.timing(panelOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start()
      } else if (shouldBeVisible && panelOpacity._value === 0) {
        Animated.timing(panelOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start()
      }
    },
    [panelOpacity],
  )

  // Configurar el acelerómetro y DeviceMotion para simular movimiento AR más realista
  useEffect(() => {
    let accelerometerSubscription = null
    let motionSubscription = null

    const setupSensors = async () => {
      try {
        // Verificar disponibilidad del acelerómetro
        const isAccelerometerAvailable = await Accelerometer.isAvailableAsync()
        const isDeviceMotionAvailable = await DeviceMotion.isAvailableAsync()

        if (isAccelerometerAvailable) {
          // Configurar la frecuencia de actualización
          Accelerometer.setUpdateInterval(16) // ~60fps

          // Suscripción al acelerómetro para movimientos más pequeños
          accelerometerSubscription = Accelerometer.addListener((accelerometerData) => {
            // Factor de sensibilidad ajustado para movimientos más naturales
            const sensitivityFactor = 0.05 // Aumentado ligeramente para más respuesta

            // Aplicar un factor de amortiguación para movimientos más suaves
            panelTranslateX.setValue(accelerometerData.x * -15 * sensitivityFactor * depthFactor)
            panelTranslateY.setValue(accelerometerData.y * 15 * sensitivityFactor * depthFactor)
          })
        }

        if (isDeviceMotionAvailable) {
          // Configurar la frecuencia de actualización
          DeviceMotion.setUpdateInterval(16)

          // Suscripción a DeviceMotion para rotación 3D
          motionSubscription = DeviceMotion.addListener((motionData) => {
            const { rotation } = motionData

            if (rotation) {
              // Convertir radianes a grados y aplicar un factor de sensibilidad
              const sensitivityFactor = 0.15 // Aumentado ligeramente
              const betaInDegrees = ((rotation.beta * 180) / Math.PI) * sensitivityFactor
              const gammaInDegrees = ((rotation.gamma * 180) / Math.PI) * sensitivityFactor

              // Actualizar la orientación actual
              const newOrientation = {
                alpha: (rotation.alpha * 180) / Math.PI,
                beta: (rotation.beta * 180) / Math.PI,
                gamma: (rotation.gamma * 180) / Math.PI,
              }
              setCurrentOrientation(newOrientation)

              // Verificar si el panel debe ser visible
              if (anchorOrientation) {
                const shouldBeVisible = checkIfPanelInView(newOrientation, anchorOrientation)
                if (shouldBeVisible !== isPanelInView) {
                  setIsPanelInView(shouldBeVisible)
                  updatePanelVisibility(shouldBeVisible)
                }
              }

              // Usar valores para la rotación visual
              panelRotateX.setValue(betaInDegrees)
              panelRotateY.setValue(gammaInDegrees)

              // Ajustar factor de profundidad basado en la orientación
              setDepthFactor(1 + Math.abs(rotation.beta) * 0.08) // Ligeramente aumentado
            }
          })
        }
      } catch (error) {
        console.error("Error al configurar los sensores:", error)
      }
    }

    setupSensors()

    // Limpiar las suscripciones cuando el componente se desmonte
    return () => {
      if (accelerometerSubscription) {
        accelerometerSubscription.remove()
      }
      if (motionSubscription) {
        motionSubscription.remove()
      }
    }
  }, [anchorOrientation, checkIfPanelInView, isPanelInView, updatePanelVisibility])

  // Función para actualizar los datos meteorológicos SIN AFECTAR LA CÁMARA
  const actualizarDatosMeteorologicos = useCallback(async () => {
    if (!ubicacion || isUpdatingData.current) {
      return
    }

    try {
      // Marcar que estamos actualizando para evitar actualizaciones simultáneas
      isUpdatingData.current = true
      setCargando(true)

      // Obtener datos en segundo plano
      const datos = await obtenerDatosMeteorologicos(ubicacion.coords.latitude, ubicacion.coords.longitude)

      // Actualizar la referencia primero (esto no causa re-render)
      datosMeteoRef.current = datos

      // Luego actualizar el estado (esto causa re-render pero es seguro)
      setDatosMeteo(datos)

      // Animar sutilmente la escala sin afectar la opacidad
      Animated.sequence([
        Animated.timing(panelScale, {
          toValue: 0.98,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(panelScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()

      // Feedback háptico sutil
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      } catch (error) {
        console.log("Haptics no disponible:", error)
      }
    } catch (error) {
      console.error("Error al obtener datos meteorológicos:", error)
    } finally {
      setCargando(false)
      // Desmarcar la actualización después de un pequeño retraso
      setTimeout(() => {
        isUpdatingData.current = false
      }, 300)
    }
  }, [ubicacion, panelScale])

  // Configurar actualización periódica de datos usando useEffect y useCallback
  useEffect(() => {
    // Actualizar datos inicialmente
    actualizarDatosMeteorologicos()

    // SOLUCIÓN CLAVE: Usar un worker separado para actualizar datos
    // Esto evita que la actualización interfiera con el renderizado de la cámara
    const setupDataUpdateInterval = () => {
      // Limpiar intervalo existente si hay uno
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }

      // Crear nuevo intervalo
      updateIntervalRef.current = setInterval(() => {
        // Solo actualizar si no estamos ya en proceso de actualización
        if (!isUpdatingData.current) {
          actualizarDatosMeteorologicos()
        }
      }, 10000)
    }

    setupDataUpdateInterval()

    // Limpiar intervalo al desmontar
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
    }
  }, [actualizarDatosMeteorologicos])

  // Función para actualizar manualmente
  const actualizarManualmente = () => {
    if (!isUpdatingData.current) {
      actualizarDatosMeteorologicos()
    }
  }

  // Función para abrir la configuración de la aplicación
  const abrirConfiguracion = () => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:")
    } else {
      Linking.openSettings()
    }
  }

  // Renderizar contenido basado en el estado de los permisos
  if (!permisoCamera) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Solicitando permisos de cámara...</Text>
      </View>
    )
  }

  if (!permisoCamera.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>No se ha concedido acceso a la cámara</Text>
        <Text style={styles.permissionSubText}>
          Esta función necesita acceso a la cámara para mostrar la visualización AR
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={abrirConfiguracion}>
          <Text style={styles.permissionButtonText}>Abrir configuración</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.permissionButton, styles.secondaryButton]} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Volver atrás</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Crear interpolaciones para rotaciones fuera del render
  const rotateXString = panelRotateX.interpolate({
    inputRange: [-30, 30],
    outputRange: ["-30deg", "30deg"],
  })

  const rotateYString = panelRotateY.interpolate({
    inputRange: [-30, 30],
    outputRange: ["-30deg", "30deg"],
  })

  // Crear interpolaciones para el efecto parallax
  const parallaxX = panelTranslateX.interpolate({
    inputRange: [-30, 30],
    outputRange: [3, -3], // Efecto parallax ajustado
  })

  const parallaxY = panelTranslateY.interpolate({
    inputRange: [-30, 30],
    outputRange: [3, -3], // Efecto parallax ajustado
  })

  // Si tenemos permisos, mostrar la vista AR
  return (
    <View style={styles.container}>
      {permisoCamera.granted && (
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          {/* Contenedor de paneles AR simulados */}
          {datosMeteo && (
            <Animated.View
              style={[
                styles.arContainer,
                {
                  opacity: panelOpacity,
                  transform: [
                    { translateX: panelTranslateX },
                    { translateY: panelTranslateY },
                    { scale: panelScale },
                    { perspective: 1000 },
                    { rotateX: rotateXString },
                    { rotateY: rotateYString },
                  ],
                },
              ]}
            >
              {/* Panel principal con BlurView para efecto de vidrio */}
              <BlurView intensity={60} tint="dark" style={styles.blurContainer}>
                <Animated.View
                  style={[
                    styles.arPanel,
                    {
                      transform: [{ translateX: parallaxX }, { translateY: parallaxY }],
                    },
                  ]}
                >
                  {/* Efecto de brillo en la parte superior */}
                  <View style={styles.glassHighlight} />

                  <Text style={styles.headerText}>{datosMeteo.nombreUbicacion}</Text>

                  {/* Condición climática */}
                  <View style={styles.condicionContainer}>
                    <Text style={styles.condicionEmoji}>{obtenerEmojiClima(datosMeteo.condicion)}</Text>
                    <Text style={styles.condicionText}>{datosMeteo.condicion}</Text>
                  </View>

                  <View style={styles.dataContainer}>
                    {/* Panel de temperatura */}
                    <View style={styles.dataPanel}>
                      <Text style={styles.dataTitleText}>Temperatura</Text>
                      <Text style={styles.temperatureText}>{datosMeteo.temperatura}°C</Text>
                      <Text style={styles.dataSmallerText}>Sensación: {datosMeteo.sensacionTermica}°C</Text>
                    </View>

                    {/* Panel de humedad */}
                    <View style={styles.dataPanel}>
                      <Text style={styles.dataTitleText}>Humedad</Text>
                      <Text style={styles.humidityText}>{datosMeteo.humedad}%</Text>
                    </View>
                  </View>

                  {/* Panel de viento */}
                  <View style={styles.windPanel}>
                    <Text style={styles.windTitle}>Viento</Text>
                    <Text style={styles.windText}>
                      {datosMeteo.viento} km/h - Dirección: {datosMeteo.direccionViento}°
                    </Text>
                  </View>

                  {/* Coordenadas */}
                  <Text style={styles.coordsText}>
                    Lat: {ubicacion?.coords.latitude.toFixed(4)}, Lon: {ubicacion?.coords.longitude.toFixed(4)}
                  </Text>

                  {/* Última actualización */}
                  <Text style={styles.updateText}>Última actualización: {new Date().toLocaleTimeString()}</Text>
                </Animated.View>
              </BlurView>
            </Animated.View>
          )}

          {/* Indicador de carga */}
          {cargando && (
            <View style={styles.loadingContainer}>
              <BlurView intensity={60} tint="dark" style={styles.loadingBlur}>
                <Text style={styles.loadingText}>Actualizando datos...</Text>
              </BlurView>
            </View>
          )}

          {/* Botón para anclar la posición actual - REPOSICIONADO MÁS ARRIBA */}
          <TouchableOpacity style={styles.botonAnclar} onPress={setCurrentPositionAsAnchor}>
            <BlurView intensity={80} tint="dark" style={styles.buttonBlur}>
              <Text style={styles.botonTexto}>Anclar Aquí</Text>
            </BlurView>
          </TouchableOpacity>

          {/* Botón flotante para actualizar manualmente */}
          <TouchableOpacity
            style={styles.botonActualizar}
            onPress={() => {
              actualizarManualmente()
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              } catch (error) {
                console.log("Haptics no disponible:", error)
              }
            }}
          >
            <BlurView intensity={80} tint="dark" style={styles.buttonBlur}>
              <Text style={styles.botonTexto}>Actualizar Datos</Text>
            </BlurView>
          </TouchableOpacity>

          {/* Botón para volver */}
          <TouchableOpacity
            style={styles.botonVolver}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              } catch (error) {
                console.log("Haptics no disponible:", error)
              }
              navigation.goBack()
            }}
          >
            <BlurView intensity={80} tint="dark" style={styles.buttonBlur}>
              <Text style={styles.botonTexto}>Volver</Text>
            </BlurView>
          </TouchableOpacity>
        </CameraView>
      )}
    </View>
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

const { width, height } = Dimensions.get("window")

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  arContainer: {
    position: "absolute",
    width: width,
    height: height,
    justifyContent: "center",
    alignItems: "center",
  },
  blurContainer: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)", // Borde más visible
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  arPanel: {
    width: width * 0.85,
    padding: 20,
    alignItems: "center",
    position: "relative",
  },
  glassHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2, // Más grueso
    backgroundColor: "rgba(255, 255, 255, 0.7)", // Más brillante
  },
  headerText: {
    color: "#FFFFFF",
    fontSize: 24, // Más grande
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  condicionContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  condicionEmoji: {
    fontSize: 50, // Más grande
    marginBottom: 5,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  condicionText: {
    color: "#FFFFFF",
    fontSize: 20, // Más grande
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
  },
  dataContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 15,
  },
  dataPanel: {
    backgroundColor: "rgba(255, 255, 255, 0.2)", // Más visible
    borderRadius: 15,
    padding: 15,
    width: "48%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)", // Más visible
  },
  dataTitleText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 5,
  },
  temperatureText: {
    color: "#FF5733", // Color más vivo
    fontSize: 32, // Más grande
    fontWeight: "bold",
    textShadowColor: "rgba(255, 87, 51, 0.6)", // Sombra más intensa
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15, // Más grande
  },
  humidityText: {
    color: "#33A1FF", // Color más vivo
    fontSize: 32, // Más grande
    fontWeight: "bold",
    textShadowColor: "rgba(51, 161, 255, 0.6)", // Sombra más intensa
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15, // Más grande
  },
  dataSmallerText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 5,
  },
  windPanel: {
    backgroundColor: "rgba(255, 255, 255, 0.2)", // Más visible
    borderRadius: 15,
    padding: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)", // Más visible
  },
  windTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 5,
  },
  windText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  coordsText: {
    color: "#FFFFFF", // Más visible
    fontSize: 14,
    marginTop: 5,
  },
  updateText: {
    color: "#FFFFFF", // Más visible
    fontSize: 12,
    marginTop: 5,
  },
  loadingContainer: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  loadingBlur: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    padding: 10,
  },
  loadingText: {
    color: "#FFFFFF",
  },
  botonActualizar: {
    position: "absolute",
    bottom: 30,
    right: 30,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1, // Más visible
    borderColor: "rgba(255, 255, 255, 0.5)", // Más visible
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  botonVolver: {
    position: "absolute",
    bottom: 30,
    left: 30,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1, // Más visible
    borderColor: "rgba(255, 255, 255, 0.5)", // Más visible
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  botonAnclar: {
    position: "absolute",
    top: 100, // REPOSICIONADO MÁS ARRIBA
    left: "50%",
    marginLeft: -60, // La mitad del ancho aproximado del botón
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    backgroundColor: "rgba(0, 102, 204, 0.3)", // Fondo azulado para distinguirlo
  },
  buttonBlur: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  botonTexto: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  permissionText: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  permissionSubText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: "#0066CC",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
    width: 200,
    alignItems: "center",
  },
  permissionButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#0066CC",
  },
  secondaryButtonText: {
    color: "#0066CC",
    fontWeight: "bold",
    fontSize: 16,
  },
})

export default ARScreen
