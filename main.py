import sys
import numpy as np
import pyaudiowpatch as pyaudio
import pyqtgraph as pg
from PyQt6.QtWidgets import QApplication, QMainWindow

class VisualizerEngine(QMainWindow):
    def __init__(self):
        super().__init__()

        # --- Technical Specifications ---
        self.CHUNK = 2048 
        self.RATE = 48000
        self.FPS = 60
        self.BINS = 64
        self.MIN_DB = -60
        self.MAX_DB = 0

        # --- Smoothing & Math Setup ---
        self.smoothing_attack = 1.0 # Instant rise
        self.smoothing_decay = 0.8  # Y_old * 0.8 as specified
        self.smoothed_y = np.full(self.BINS, self.MIN_DB, dtype=np.float64)
        self.window = np.hanning(self.CHUNK)

        # --- Audio Setup ---
        self.p = pyaudio.PyAudio()
        self.stream = self._setup_loopback_stream()

        # --- GUI Setup ---
        self._setup_ui()

        # --- Frequency Binning Setup ---
        self._setup_log_bins()

        # --- Timer for 60 FPS Refresh ---
        self.timer = pg.QtCore.QTimer()
        self.timer.timeout.connect(self.update_visualization)
        self.timer.start(1000 // self.FPS)

    def _setup_loopback_stream(self):
        """Finds the default WASAPI loopback device to capture system audio."""
        wasapi_info = self.p.get_host_api_info_by_type(pyaudio.paWASAPI)
        default_speakers = self.p.get_device_info_by_index(wasapi_info["defaultOutputDevice"])
        
        if not default_speakers["isLoopbackDevice"]:
            # Search for loopback device associated with default speakers
            for loopback in self.p.get_loopback_device_info_generator():
                if default_speakers["name"] in loopback["name"]:
                    default_speakers = loopback
                    break

        return self.p.open(
            format=pyaudio.paInt16,
            channels=default_speakers["maxInputChannels"],
            rate=int(default_speakers["defaultSampleRate"]),
            frames_per_buffer=self.CHUNK,
            input=True,
            input_device_index=default_speakers["index"]
        )

    def _setup_ui(self):
        """Configures PyQtGraph for maximum performance and aesthetics."""
        self.setWindowTitle("High-Performance Spectral Visualizer")
        self.resize(1000, 400)

        self.graph_widget = pg.PlotWidget()
        self.setCentralWidget(self.graph_widget)
        self.graph_widget.setBackground('k') # Black background
        self.graph_widget.setYRange(self.MIN_DB, self.MAX_DB)
        self.graph_widget.hideAxis('bottom')
        self.graph_widget.hideAxis('left')
        
        # Using stepMode="center" creates a bar-graph look but renders as a single 
        # path object, drastically reducing CPU load compared to individual BarGraphItems.
        self.plot = self.graph_widget.plot(
            stepMode="center", 
            fillLevel=self.MIN_DB, 
            brush=(0, 255, 200, 150), # Cyan glow
            pen=pg.mkPen('c', width=2)
        )

    def _setup_log_bins(self):
        """Calculates the logarithmic frequency groupings."""
        # FFT returns CHUNK/2 + 1 frequencies
        freqs = np.fft.rfftfreq(self.CHUNK, 1.0 / self.RATE)
        
        # Create logarithmically spaced bin edges from 20Hz to 20kHz
        self.bin_edges = np.logspace(np.log10(20), np.log10(20000), self.BINS + 1)
        
        # Map raw FFT indices to our log bins
        self.bin_indices = np.searchsorted(freqs, self.bin_edges)
        
        # X-axis coordinates for the stepped plot (requires len(y) + 1 points)
        self.x_axis = np.arange(self.BINS + 1)

    def update_visualization(self):
        """Core signal processing pipeline."""
        try:
            # 1. Read Raw Data
            raw_data = self.stream.read(self.CHUNK, exception_on_overflow=False)
            audio_data = np.frombuffer(raw_data, dtype=np.int16)

            # If stereo, average channels to mono
            if len(audio_data) == self.CHUNK * 2:
                audio_data = audio_data.reshape(-1, 2).mean(axis=1)

            # 2. Windowing Function (Hanning)
            windowed_data = audio_data * self.window

            # 3. FFT Computation
            fft_data = np.abs(np.fft.rfft(windowed_data))

            # 4. Logarithmic Frequency Binning
            binned_data = np.zeros(self.BINS)
            for i in range(self.BINS):
                start = self.bin_indices[i]
                end = self.bin_indices[i+1]
                if start == end:
                    end = start + 1 # Ensure at least one bin is sampled
                binned_data[i] = np.mean(fft_data[start:end])

            # 5. Amplitude Scaling (Decibels)
            # Add a tiny offset (1e-6) to prevent log(0) errors
            db_data = 20 * np.log10(binned_data + 1e-6)
            
            # Normalize to our view range
            db_data = np.clip(db_data - 60, self.MIN_DB, self.MAX_DB)

            # 6. Temporal Smoothing (Gravity Effect)
            # Attack: If new > old, snap immediately (or use a fast factor)
            # Decay: If new < old, fall slowly using the 0.2 / 0.8 formula
            for i in range(self.BINS):
                if db_data[i] > self.smoothed_y[i]:
                    self.smoothed_y[i] = db_data[i] # Instant Attack
                else:
                    self.smoothed_y[i] = (db_data[i] * (1.0 - self.smoothing_decay)) + \
                                         (self.smoothed_y[i] * self.smoothing_decay)

            # 7. Update UI
            self.plot.setData(self.x_axis, self.smoothed_y)

        except Exception as e:
            print(f"Stream error: {e}")

    def closeEvent(self, event):
        """Clean up audio streams on exit."""
        self.stream.stop_stream()
        self.stream.close()
        self.p.terminate()
        event.accept()

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = VisualizerEngine()
    window.show()
    sys.exit(app.exec())