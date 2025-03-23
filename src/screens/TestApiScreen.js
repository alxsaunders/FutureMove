import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Button, Alert } from 'react-native';

const API_URL = 'http://10.0.2.2:3001/api';

const TestApiScreen = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const testGet = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/test`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testPost = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: '434534123',
          username: 'testuser',
          name: 'Test User',
          email: 'testuser@example.com',
          password: '',
          level: 1,
          xp_points: 0,
          future_coins: 0,
          created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
          last_login: null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unknown POST error');
      }
      Alert.alert('✅ POST Success', JSON.stringify(data));
    } catch (err) {
      setError(err.message);
      Alert.alert('❌ POST Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>API Test</Text>

      {loading && <ActivityIndicator size="large" color="#007bff" />}
      {result && <Text style={styles.success}>✅ Success: {JSON.stringify(result)}</Text>}
      {error && <Text style={styles.error}>❌ Error: {error}</Text>}

      <View style={{ marginTop: 16 }}>
        <Button title="RETRY GET" onPress={testGet} />
      </View>

      <View style={{ marginTop: 16 }}>
        <Button title="TEST POST" color="#28a745" onPress={testPost} />
      </View>
    </View>
  );
};

export default TestApiScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 22,
    marginBottom: 16,
    fontWeight: 'bold'
  },
  success: {
    marginTop: 20,
    color: 'green',
    fontSize: 16
  },
  error: {
    marginTop: 20,
    color: 'red',
    fontSize: 16
  }
});
