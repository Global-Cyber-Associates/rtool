import sys
import os
import subprocess
import time
import traceback
import zipfile
import requests

from PyQt6.QtWidgets import (
    QApplication, QWizard, QWizardPage, QVBoxLayout, QLabel,
    QLineEdit, QPushButton, QFileDialog, QProgressBar,
    QMessageBox, QCheckBox
)
from PyQt6.QtCore import QThread, pyqtSignal


# -------------------------------------------------------------------
# STEP 1: Bootstrap minimal dependencies (safe for new systems)
# -------------------------------------------------------------------
def bootstrap_environment():
    """Ensure pip, setuptools, wheel, PyQt6, and requests are installed."""
    try:
        print("[🔧] Bootstrapping environment...")
        subprocess.call([sys.executable, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"])

        subprocess.call([
            sys.executable, "-m", "pip", "install",
            "--only-binary=:all:",
            "PyQt6",
            "requests"
        ])
        print("[✅] Core dependencies ready.\n")
    except Exception as e:
        print(f"[❌] Bootstrap failed: {e}")


# -------------------------------------------------------------------
# STEP 2: Background installation thread
# -------------------------------------------------------------------
class InstallWorker(QThread):
    progress = pyqtSignal(int)
    status = pyqtSignal(str)
    finished = pyqtSignal(bool, str)

    def __init__(self, install_path, agent_id, backend_url):
        super().__init__()
        self.install_path = install_path
        self.agent_id = agent_id
        self.backend_url = backend_url
        self.update_url = "http://4.213.152.243/agent.zip"  # your CDN file

    def check_cdn_reachable(self):
        self.status.emit("Checking CDN reachability...")
        try:
            response = requests.head(self.update_url, timeout=8)
            if response.status_code == 200:
                return True
            else:
                self.status.emit(f"CDN returned HTTP {response.status_code}")
                return False
        except Exception as e:
            self.status.emit(f"CDN check failed: {e}")
            return False

    def download_zip(self, dest_path):
        """Download agent.zip with progress tracking."""
        self.status.emit("Downloading agent package...")
        try:
            with requests.get(self.update_url, stream=True, timeout=15) as r:
                r.raise_for_status()
                total = int(r.headers.get("content-length", 0))
                done = 0
                with open(dest_path, "wb") as f:
                    for chunk in r.iter_content(8192):
                        if chunk:
                            f.write(chunk)
                            done += len(chunk)
                            if total:
                                self.progress.emit(20 + int((done / total) * 40))
            return True
        except Exception as e:
            self.status.emit(f"❌ Download failed: {e}")
            return False

    def extract_zip(self, zip_path):
        """Extract the downloaded zip."""
        self.status.emit("Extracting package...")
        try:
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(self.install_path)
            os.remove(zip_path)
            return True
        except Exception as e:
            self.status.emit(f"❌ Extraction failed: {e}")
            return False

    def install_requirements(self):
        """Install dependencies from requirements.txt inside the agent folder."""
        req_file = os.path.join(self.install_path, "requirements.txt")
        if not os.path.exists(req_file):
            self.status.emit("⚠️ No requirements.txt found — skipping dependency install.")
            return True
        try:
            self.status.emit("Installing dependencies from requirements.txt...")
            subprocess.check_call([
                sys.executable, "-m", "pip", "install",
                "--no-cache-dir", "--only-binary=:all:",
                "-r", req_file
            ])
            self.status.emit("✅ All dependencies installed successfully.")
            return True
        except subprocess.CalledProcessError as e:
            self.status.emit(f"❌ Dependency install failed: {e}")
            return False

    def run(self):
        try:
            os.makedirs(self.install_path, exist_ok=True)
            self.progress.emit(10)

            # Step 1: Validate CDN
            if not self.check_cdn_reachable():
                self.finished.emit(False, "❌ CDN unreachable.")
                return

            # Step 2: Write configuration
            self.status.emit("Writing configuration (.env)...")
            env_path = os.path.join(self.install_path, ".env")
            with open(env_path, "w") as f:
                f.write(f"AGENT_ID={self.agent_id}\n")
                f.write(f"BACKEND_URL={self.backend_url}\n")
                f.write(f"UPDATE_URL={self.update_url}\n")

            # Step 3: Download and extract
            zip_path = os.path.join(self.install_path, "agent.zip")
            if not self.download_zip(zip_path):
                self.finished.emit(False, "❌ Failed to download agent.zip.")
                return

            if not self.extract_zip(zip_path):
                self.finished.emit(False, "❌ Failed to extract agent.zip.")
                return

            # Step 4: Install dependencies
            self.progress.emit(85)
            if not self.install_requirements():
                self.finished.emit(False, "❌ Dependency installation failed.")
                return

            self.progress.emit(100)
            self.status.emit("✅ Installation completed successfully!")
            self.finished.emit(True, f"Installed at: {self.install_path}")

        except Exception as e:
            self.finished.emit(False, f"❌ Unexpected error:\n{e}\n\n{traceback.format_exc()}")


# -------------------------------------------------------------------
# STEP 3: Wizard UI
# -------------------------------------------------------------------
class WelcomePage(QWizardPage):
    def __init__(self):
        super().__init__()
        self.setTitle("Welcome to System Monitor Setup")
        layout = QVBoxLayout()
        label = QLabel(
            "This wizard will install the System Monitor Agent on your system.\n"
            "It will set up your Agent ID, Backend URL, and dependencies."
        )
        label.setWordWrap(True)
        layout.addWidget(label)
        self.setLayout(layout)


class ConfigPage(QWizardPage):
    def __init__(self):
        super().__init__()
        self.setTitle("Configuration")
        self.agent_id = QLineEdit()
        self.backend_url = QLineEdit()
        layout = QVBoxLayout()
        layout.addWidget(QLabel("Enter Agent ID:"))
        layout.addWidget(self.agent_id)
        layout.addWidget(QLabel("Enter Backend URL:"))
        layout.addWidget(self.backend_url)
        self.setLayout(layout)

    def validatePage(self):
        if not self.agent_id.text().strip() or not self.backend_url.text().strip():
            QMessageBox.warning(self, "Missing Fields", "Both Agent ID and Backend URL are required.")
            return False
        return True


class DirectoryPage(QWizardPage):
    def __init__(self):
        super().__init__()
        self.setTitle("Choose Installation Folder")
        self.path_input = QLineEdit()
        browse_btn = QPushButton("Browse")
        browse_btn.clicked.connect(self.browse)
        layout = QVBoxLayout()
        layout.addWidget(QLabel("Select installation directory:"))
        layout.addWidget(self.path_input)
        layout.addWidget(browse_btn)
        self.setLayout(layout)

    def browse(self):
        path = QFileDialog.getExistingDirectory(self, "Select Folder")
        if path:
            self.path_input.setText(path)

    def validatePage(self):
        if not self.path_input.text().strip():
            QMessageBox.warning(self, "Missing Folder", "Please choose a valid folder.")
            return False
        return True


class InstallPage(QWizardPage):
    def __init__(self):
        super().__init__()
        self.setTitle("Installing Agent")
        self.progress = QProgressBar()
        self.status = QLabel("Preparing installation...")
        layout = QVBoxLayout()
        layout.addWidget(self.status)
        layout.addWidget(self.progress)
        self.setLayout(layout)
        self.worker = None

    def initializePage(self):
        path = self.wizard().page(2).path_input.text()
        agent_id = self.wizard().page(1).agent_id.text()
        backend_url = self.wizard().page(1).backend_url.text()

        self.worker = InstallWorker(path, agent_id, backend_url)
        self.worker.progress.connect(self.progress.setValue)
        self.worker.status.connect(self.status.setText)
        self.worker.finished.connect(self.on_finish)
        self.worker.start()

    def on_finish(self, success, message):
        self.status.setText(message)
        if success:
            self.progress.setValue(100)
        else:
            self.progress.setStyleSheet("QProgressBar::chunk { background-color: red; }")
            QMessageBox.critical(self, "Installation Failed", message)


class FinishPage(QWizardPage):
    def __init__(self):
        super().__init__()
        self.setTitle("Setup Complete")
        self.launch_checkbox = QCheckBox("Launch System Monitor Agent now")
        layout = QVBoxLayout()
        layout.addWidget(QLabel("Setup finished successfully."))
        layout.addWidget(self.launch_checkbox)
        self.setLayout(layout)

    def cleanupPage(self):
        if self.launch_checkbox.isChecked():
            install_path = self.wizard().page(2).path_input.text()
            main_script = os.path.join(install_path, "main.py")
            if os.path.exists(main_script):
                subprocess.Popen([sys.executable, main_script])
                QMessageBox.information(self, "Started", "Agent is now running.")


# -------------------------------------------------------------------
# STEP 4: Wizard Controller
# -------------------------------------------------------------------
class InstallerWizard(QWizard):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("System Monitor Agent Installer")
        self.setWizardStyle(QWizard.WizardStyle.ModernStyle)
        self.setFixedSize(520, 380)
        self.addPage(WelcomePage())
        self.addPage(ConfigPage())
        self.addPage(DirectoryPage())
        self.addPage(InstallPage())
        self.addPage(FinishPage())


# -------------------------------------------------------------------
# STEP 5: Entry Point
# -------------------------------------------------------------------
if __name__ == "__main__":
    try:
        bootstrap_environment()
        app = QApplication(sys.argv)
        wizard = InstallerWizard()
        wizard.show()
        sys.exit(app.exec())
    except Exception as e:
        print(f"❌ Critical error launching installer: {e}")
        traceback.print_exc()
