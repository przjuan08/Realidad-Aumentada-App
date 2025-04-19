import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { StatusBar } from "expo-status-bar"
import { LogBox } from "react-native"

// Importar pantallas
import HomeScreen from "./screens/HomeScreen"
import ARScreen from "./screens/ARScreen"

// Ignorar advertencias específicas que no afectan la funcionalidad
LogBox.ignoreLogs([
  "Possible Unhandled Promise Rejection",
  "ViewPropTypes will be removed",
  "AsyncStorage has been extracted",
])

// Crear el navegador de stack para manejar las pantallas
const Stack = createStackNavigator()

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Monitor Meteorológico AR" }} />
        <Stack.Screen
          name="AR"
          component={ARScreen}
          options={{
            title: "Visualización AR",
            headerShown: false, // Ocultamos el header para una mejor experiencia AR
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
