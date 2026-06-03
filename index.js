const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = 3000;
const UPLOAD_PATH = '/mnt/angela/bumblebee_vault';

mongoose.connect('mongodb://localhost:27017/bumblebee_sandbox')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ DB Error:', err));

const FileSchema = new mongoose.Schema({
    originalName: String, 
    storedName: String,   
    path: String,         
    size: Number,
    uploadDate: { type: Date, default: Date.now }
});
const FileModel = mongoose.model('File', FileSchema);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_PATH);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/upload', upload.single('myFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const newFile = new FileModel({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        path: req.file.path,
        size: req.file.size
    });

    await newFile.save(); 
    console.log(`💾 Saved ${req.file.originalname} to Drive & DB`);

    res.send(`Success! Saved as ${req.file.filename}`);
});
app.get('/download/latest', async (req, res) => {
    try {
        const lastFile = await FileModel.findOne().sort({ uploadDate: -1 });

        if (!lastFile) {
            return res.status(404).send("No files found in the vault.");
        }
        const filePath = path.join(UPLOAD_PATH, lastFile.storedName);

        res.download(filePath, lastFile.originalName, (err) => {
            if (err) {
                console.error("Error sending file:", err);
                res.status(500).send("Could not download file.");
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.delete('/delete/latest', async (req, res) => {
    try {
        const fileToDelete = await FileModel.findOne().sort({ uploadDate: -1 });

        if (!fileToDelete) {
            return res.status(404).send("Nothing to delete.");
        }
        if (fs.existsSync(fileToDelete.path)) {
            fs.unlinkSync(fileToDelete.path);
            console.log(`🗑️ Physically deleted: ${fileToDelete.storedName}`);
        }

        await FileModel.deleteOne({ _id: fileToDelete._id });
        console.log(`🔥 Database record erased.`);

        res.send(`Deleted ${fileToDelete.originalName} successfully.`);

    } catch (err) {
        console.error(err);
        res.status(500).send("Could not delete file.");
    }
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
