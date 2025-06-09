const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');
const uploadPath = path.join(__dirname, '../public/uploads');

exports.createContent = async (req, res) => {
  try {
    const { title, description, type, duration, tvId } = req.body;
    const filePath = req.file.filename;

    const content = await prisma.content.create({
      data: {
        title,
        description,
        filePath,
        type,
        duration: parseInt(duration),
        tvId
      }
    });
    res.status(201).json(content);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllContents = async (req, res) => {
  try {
    // Primeiro busca as TVs do usuário
    const userTVs = await prisma.tV.findMany({
      where: { userId: req.session.user.id },
      select: { id: true }
    });
    
    const tvIds = userTVs.map(tv => tv.id);
    
    const contents = await prisma.content.findMany({
      where: { tvId: { in: tvIds } }
    });
    
    res.json(contents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getContentsByTV = async (req, res) => {
  try {
    // 1. Encontra a TV pelo código
    const tv = await prisma.tV.findUnique({
      where: { code: req.params.tvCode }
    });

    if (!tv) {
      return res.status(404).json({ error: `TV com código ${req.params.tvCode} não encontrada` });
    }

    // 2. Busca os conteúdos associados a essa TV
    const contents = await prisma.content.findMany({
      where: { 
        tvId: tv.id,
        isActive: true 
      },
      orderBy: { createdAt: 'desc' }
    });

    //console.log(`Conteúdos encontrados para TV ${req.params.tvCode}:`, contents); // Log para debug
    
    res.json(contents);
  } catch (error) {
    console.error('Erro ao buscar conteúdos:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar conteúdos',
      details: error.message 
    });
  }
};
exports.getContentById = async (req, res) => {
  try {
    const content = await prisma.content.findUnique({
      where: { id: req.params.id }
    });
    if (!content) return res.status(404).json({ error: 'Conteúdo não encontrado' });
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateContent = async (req, res) => {
  try {
    const content = await prisma.content.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(content);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteContent = async (req, res) => {
  try {
    // 1. Buscar o conteúdo para pegar o caminho do arquivo
    const content = await prisma.content.findUnique({
      where: { id: req.params.id }
    });

    if (!content) {
      return res.status(404).json({ error: 'Conteúdo não encontrado' });
    }

    // 2. Excluir o conteúdo do banco de dados
    await prisma.content.delete({ where: { id: req.params.id } });

    // 3. Remover o arquivo do servidor
    const filePath = path.join(uploadPath, content.filePath);
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Erro ao excluir o arquivo:', err);
      } else {
        console.log('Arquivo removido com sucesso:', filePath);
      }
    });

    res.json({ message: 'Conteúdo e arquivo excluídos com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
