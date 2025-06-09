const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Criar uma nova TV associada ao usuário logado
exports.createTV = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { code, name, description, location } = req.body;

    const tv = await prisma.tV.create({
      data: {
        code,
        name,
        description,
        location,
        userId: req.session.user.id
      }
    });

    res.status(201).json(tv);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Listar TVs apenas do usuário logado
exports.getAllTVs = async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const tvs = await prisma.tV.findMany({
      where: { userId }, // Filtra pelo ID do usuário logado
      include: { contents: true }
    });

    res.json(tvs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Buscar uma TV específica (opcionalmente, você pode validar o userId também)
exports.getTVById = async (req, res) => {
  try {
    const tv = await prisma.tV.findUnique({
      where: { id: req.params.id },
      include: { contents: true }
    });

    if (!tv) return res.status(404).json({ error: 'TV não encontrada' });

    res.json(tv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Atualizar TV
exports.updateTV = async (req, res) => {
  try {
    const tv = await prisma.tV.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json(tv);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Deletar TV
exports.deleteTV = async (req, res) => {
  try {
    await prisma.tV.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'TV excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
