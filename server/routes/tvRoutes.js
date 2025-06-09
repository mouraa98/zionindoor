const express = require('express');
const router = express.Router();
const TVController = require('../controllers/TVController');
const ContentController = require('../controllers/ContentController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');


// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const contentType = req.body.type;
    const fileTypes = {
      'IMAGE': /image\/(jpeg|jpg|png|gif)/,
      'VIDEO': /video\/(mp4|webm|ogg)/,
      'HTML': /text\/html/
    };
    
    if (contentType && fileTypes[contentType]) {
      const isValidType = fileTypes[contentType].test(file.mimetype);
      if (isValidType) {
        cb(null, true);
      } else {
        cb(new Error(`Tipo de arquivo inválido para ${contentType}.`));
      }
    } else {
      cb(new Error('Tipo de conteúdo não especificado ou inválido.'));
    }
  },
   limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // ✅ 5GB
  }
});

// Rota para upload de conteúdo
router.post('/api/contents', upload.single('file'), async (req, res) => {
  try {
    // Validação dos campos
    const { title, description, type, duration, tvId } = req.body;
    
    if (!title || !type || !duration || !tvId) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios faltando: title, type, duration, tvId' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Criar objeto de conteúdo
    const content = {
      id: uuidv4(),
      title,
      description: description || '',
      type,
      duration: parseInt(duration),
      tvId,
      filePath: `/public/uploads/${req.file.filename}`,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Aqui você normalmente salvaria no banco de dados
    // Por enquanto, vamos apenas retornar o objeto criado
    res.status(201).json(content);

  } catch (error) {
    console.error('Erro no upload de conteúdo:', error);
    
    // Se houver um arquivo temporário, remove em caso de erro
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Erro ao remover arquivo temporário:', err);
      });
    }

    res.status(500).json({ 
      error: 'Erro ao processar o upload',
      details: error.message 
    });
  }
});



// Rotas para TVs
router.post('/tvs', TVController.createTV);
router.get('/tvs', TVController.getAllTVs);
router.get('/tvs/:id', TVController.getTVById);
router.put('/tvs/:id', TVController.updateTV);
router.delete('/tvs/:id', TVController.deleteTV);

// Rotas para Conteúdos
router.post('/contents', upload.single('file'), ContentController.createContent);
router.get('/contents', ContentController.getAllContents);
router.get('/contents/tv/:tvCode', ContentController.getContentsByTV);
router.get('/contents/:id', ContentController.getContentById);
router.put('/contents/:id', ContentController.updateContent);
router.delete('/contents/:id', ContentController.deleteContent);







module.exports = router;