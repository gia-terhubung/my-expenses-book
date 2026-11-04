import { Link } from "expo-router";
import { View } from "react-native";

export default function Index() {
  return (
    <View style={{ flex: 1 }}>
      {__DEV__ && <Link href="/db-spike">DB spike</Link>}
    </View>
  );
}
