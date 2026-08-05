// Minimal ambient types for the Web Bluetooth APIs used by src/lib/printer.ts.
// Not in default TS lib; avoids pulling in @types/web-bluetooth as a dependency.

interface BluetoothRemoteGATTCharacteristic {
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
    [key: string]: boolean;
  };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

interface RequestDeviceOptions {
  acceptAllDevices?: boolean;
  filters?: { services?: string[]; name?: string; namePrefix?: string }[];
  optionalServices?: string[];
}

interface Bluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
  getDevices?(): Promise<BluetoothDevice[]>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}
