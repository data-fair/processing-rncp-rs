import type { Repertoire, Field } from './common.ts'
import {
  SEP, text, richText, itemsJoin, directJoin,
  juryActif, juryComposition, statistiquesPromotions, publicationDecret, correspondances
} from './common.ts'

const DATASET_DESCRIPTION = `**France compétences** a la responsabilité confiée par le législateur d’enregistrer, de mettre à jour et de rendre accessible les certifications inscrites au Répertoire spécifique (RS).

Les certifications et habilitations enregistrées au **RS** correspondent à des compétences professionnelles complémentaires aux certifications professionnelles.

Jeu de données généré à partir du flux V4-1 publié sur data.gouv.fr (mise à jour hebdomadaire).`

const schema: Field[] = [
  // ---- Colonnes historiques (ordre conservé pour la stabilité du jeu de données) ----
  { key: 'ID_FICHE', type: 'integer', title: 'Identifiant de fiche', description: 'Identifiant technique de la fiche répertoire.', extract: (f) => text(f, 'ID_FICHE') },
  { key: 'NUMERO_FICHE', type: 'string', title: 'Numéro de fiche', description: 'Code de la fiche répertoire (ex. RS2381).', extract: (f) => text(f, 'NUMERO_FICHE') },
  { key: 'INTITULE', type: 'string', title: 'Intitulé', description: 'Intitulé de la certification.', 'x-refersTo': 'http://www.w3.org/2000/01/rdf-schema#label', extract: (f) => text(f, 'INTITULE') },
  { key: 'ETAT_FICHE', type: 'string', title: 'État de la fiche', description: 'État dans lequel se trouve la fiche.', enum: ['Publiée', 'Dépubliée/Archivée', 'Modifications à valider', 'Modifications à valider par le ministère'], extract: (f) => text(f, 'ETAT_FICHE') },
  { key: 'FORMACODES', type: 'string', title: 'Codes Formacode', description: 'Codes Formacode (domaines de formation).', separator: SEP, extract: (f) => itemsJoin(f, 'FORMACODES', 'FORMACODE', 'CODE') },
  { key: 'FORMALIBELLES', type: 'string', title: 'Libellés Formacode', description: 'Libellés Formacode correspondants.', separator: SEP, extract: (f) => itemsJoin(f, 'FORMACODES', 'FORMACODE', 'LIBELLE') },
  { key: 'CODES_NSF', type: 'string', title: 'Codes NSF', description: 'Codes de la nomenclature des spécialités de formation (NSF).', separator: SEP, extract: (f) => itemsJoin(f, 'CODES_NSF', 'NSF', 'CODE') },
  { key: 'INTITULE_NSF', type: 'string', title: 'Intitulés NSF', description: 'Intitulés des spécialités de formation (NSF).', separator: SEP, extract: (f) => itemsJoin(f, 'CODES_NSF', 'NSF', ['LIBELLE', 'INTITULE']) },
  { key: 'CERTIFICATEURS', type: 'string', title: 'Certificateurs', description: 'Noms des organismes certificateurs.', separator: SEP, extract: (f) => itemsJoin(f, 'CERTIFICATEURS', 'CERTIFICATEUR', 'NOM_CERTIFICATEUR') },
  { key: 'CAPACITES_ATTESTEES', type: 'string', title: 'Compétences attestées', description: 'Compétences attestées par la certification.', 'x-display': 'markdown', extract: (f) => richText(f, 'CAPACITES_ATTESTEES') },
  { key: 'LIEN_URL_DESCRIPTION', type: 'string', title: 'Lien vers le descriptif', description: 'Lien internet vers le descriptif de la certification.', 'x-refersTo': 'https://schema.org/WebPage', extract: (f) => richText(f, 'LIEN_URL_DESCRIPTION') },
  { key: 'REGLEMENTATIONS_ACTIVITES', type: 'string', title: 'Réglementations d’activités', description: 'Références juridiques des réglementations d’activités.', 'x-display': 'markdown', extract: (f) => richText(f, 'REGLEMENTATIONS_ACTIVITES') },
  { key: 'DATE_FIN_ENREGISTREMENT', type: 'string', format: 'date', title: 'Date de fin d’enregistrement', description: 'Date d’échéance de l’enregistrement.', 'x-refersTo': 'https://schema.org/endDate', extract: (f) => text(f, 'DATE_FIN_ENREGISTREMENT') },
  { key: 'TYPE_ENREGISTREMENT', type: 'string', title: 'Type d’enregistrement', description: 'Type d’enregistrement de la certification.', enum: ['Enregistrement de droit', 'Enregistrement sur demande'], extract: (f) => text(f, 'TYPE_ENREGISTREMENT') },
  { key: 'OBJECTIFS_CONTEXTE', type: 'string', title: 'Objectifs et contexte', description: 'Objectifs et contexte de la certification.', 'x-display': 'markdown', 'x-refersTo': 'http://schema.org/description', extract: (f) => richText(f, 'OBJECTIFS_CONTEXTE') },
  { key: 'NIVEAU_MAITRISE_COMPETENCES', type: 'string', title: 'Niveau de maîtrise des compétences', description: 'Niveau de maîtrise des compétences.', 'x-display': 'markdown', extract: (f) => richText(f, 'NIVEAU_MAITRISE_COMPETENCES') },
  { key: 'MODALITES_RENOUVELLEMENT', type: 'string', title: 'Modalités de renouvellement', description: 'Modalités de renouvellement de la certification.', 'x-display': 'markdown', extract: (f) => richText(f, 'MODALITES_RENOUVELLEMENT') },
  { key: 'VALIDATION_PARTIELLE', type: 'boolean', title: 'Validation partielle', description: 'Possibilité de validation partielle.', extract: (f) => text(f, 'VALIDATION_PARTIELLE') },
  { key: 'ACTIF', type: 'boolean', title: 'Active', description: 'La certification est active (enregistrement en cours) ou inactive.', extract: (f) => text(f, 'ACTIF') },

  // ---- Colonnes ajoutées (flux V4-1, non destructif) ----
  { key: 'SI_JURY_FI', type: 'boolean', title: 'Voie d’accès : formation initiale', description: 'Accès par un parcours de formation sous statut d’élève.', extract: (f) => juryActif(f, 'SI_JURY_FI') },
  { key: 'JURY_FI', type: 'string', title: 'Jury — formation initiale', description: 'Composition du jury pour la voie formation initiale.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_FI') },
  { key: 'SI_JURY_FC', type: 'boolean', title: 'Voie d’accès : formation continue', description: 'Accès après un parcours de formation continue.', extract: (f) => juryActif(f, 'SI_JURY_FC') },
  { key: 'JURY_FC', type: 'string', title: 'Jury — formation continue', description: 'Composition du jury pour la voie formation continue.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_FC') },
  { key: 'SI_JURY_CQ', type: 'boolean', title: 'Voie d’accès : contrat de professionnalisation', description: 'Accès en contrat de professionnalisation.', extract: (f) => juryActif(f, 'SI_JURY_CQ') },
  { key: 'JURY_CQ', type: 'string', title: 'Jury — contrat de professionnalisation', description: 'Composition du jury pour la voie contrat de professionnalisation.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_CQ') },
  { key: 'SI_JURY_CL', type: 'boolean', title: 'Voie d’accès : candidature individuelle', description: 'Accès par candidature individuelle.', extract: (f) => juryActif(f, 'SI_JURY_CL') },
  { key: 'JURY_CL', type: 'string', title: 'Jury — candidature individuelle', description: 'Composition du jury pour la voie candidature individuelle.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_CL') },
  { key: 'SI_JURY_VAE', type: 'boolean', title: 'Voie d’accès : VAE', description: 'Accès par validation des acquis de l’expérience (ou hors dispositif VAE pour le RS).', extract: (f) => juryActif(f, 'SI_JURY_VAE') },
  { key: 'JURY_VAE', type: 'string', title: 'Jury — VAE', description: 'Composition du jury pour la voie VAE.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_VAE') },
  { key: 'CCN_1_NUMERO', type: 'string', title: 'CCN 1 — numéro', description: 'Numéro de la convention collective nationale 1.', extract: (f) => directJoin(f, 'CCN_1', 'NUMERO') },
  { key: 'CCN_1_LIBELLE', type: 'string', title: 'CCN 1 — libellé', description: 'Libellé de la convention collective nationale 1.', extract: (f) => directJoin(f, 'CCN_1', 'LIBELLE') },
  { key: 'CODES_IDCC', type: 'string', title: 'Codes IDCC', description: 'Identifiants des conventions collectives (IDCC).', separator: SEP, extract: (f) => itemsJoin(f, 'CODES_IDCC', 'IDCC', 'CODE') },
  { key: 'LIBELLES_IDCC', type: 'string', title: 'Libellés IDCC', description: 'Libellés des conventions collectives (IDCC).', separator: SEP, extract: (f) => itemsJoin(f, 'CODES_IDCC', 'IDCC', 'LIBELLE') },
  { key: 'DATE_DECISION', type: 'string', title: 'Date de décision', description: 'Date de la décision d’enregistrement.', extract: (f) => text(f, 'DATE_DECISION') },
  { key: 'DATE_EFFET', type: 'string', title: 'Date d’effet', description: 'Date d’effet du dernier arrêté concernant la certification.', 'x-refersTo': 'https://schema.org/startDate', extract: (f) => text(f, 'DATE_EFFET') },
  { key: 'DATE_DERNIER_JO', type: 'string', title: 'Date du dernier JO', description: 'Date du dernier Journal officiel ou Bulletin officiel.', extract: (f) => text(f, 'DATE_DERNIER_JO') },
  { key: 'DUREE_ENREGISTREMENT', type: 'string', title: 'Durée d’enregistrement', description: 'Durée de l’enregistrement de la certification (en années).', extract: (f) => text(f, 'DUREE_ENREGISTREMENT') },
  { key: 'DUREE_VALIDITE', type: 'string', title: 'Durée de validité', description: 'Durée de validité de la certification (en années).', extract: (f) => text(f, 'DUREE_VALIDITE') },
  { key: 'EXISTENCE_PARTENAIRES', type: 'boolean', title: 'Existence de partenaires', description: 'Existence potentielle d’habilitations de partenaires.', extract: (f) => text(f, 'EXISTENCE_PARTENAIRES') },
  { key: 'PARTENAIRES', type: 'string', title: 'Partenaires', description: 'Organismes habilités préparant à la certification.', separator: SEP, extract: (f) => itemsJoin(f, 'PARTENAIRES', 'PARTENAIRE', 'NOM_PARTENAIRE') },
  { key: 'SIRET_PARTENAIRES', type: 'string', title: 'SIRET des partenaires', description: 'SIRET des organismes partenaires habilités.', separator: SEP, extract: (f) => itemsJoin(f, 'PARTENAIRES', 'PARTENAIRE', 'SIRET_PARTENAIRE') },
  { key: 'SIRET_CERTIFICATEURS', type: 'string', title: 'SIRET des certificateurs', description: 'SIRET des organismes certificateurs.', separator: SEP, extract: (f) => itemsJoin(f, 'CERTIFICATEURS', 'CERTIFICATEUR', 'SIRET_CERTIFICATEUR') },
  { key: 'VALIDATION_PARTIELLE_PERIMETRE', type: 'string', title: 'Périmètre de validation partielle', description: 'Périmètre de la validation partielle.', 'x-display': 'markdown', extract: (f) => richText(f, 'VALIDATION_PARTIELLE_PERIMETRE') },
  { key: 'PUBLICATION_DECRET_GENERAL', type: 'string', title: 'Textes réglementaires (général)', description: 'Références JO/BO instaurant la certification.', extract: (f) => publicationDecret(f, 'PUBLICATION_DECRET_GENERAL') },
  { key: 'PUBLICATION_DECRET_CREATION', type: 'string', title: 'Textes réglementaires (création)', description: 'Arrêtés et décisions publiés au JO ou au BO.', extract: (f) => publicationDecret(f, 'PUBLICATION_DECRET_CREATION') },
  { key: 'PUBLICATION_DECRET_AUTRE', type: 'string', title: 'Textes réglementaires (autres)', description: 'Autres références réglementaires.', extract: (f) => publicationDecret(f, 'PUBLICATION_DECRET_AUTRE') },
  { key: 'STATISTIQUES_PROMOTIONS', type: 'string', title: 'Statistiques des promotions', description: 'Statistiques par année : nombre de certifiés, VAE, taux d’insertion.', extract: (f) => statistiquesPromotions(f) },
  { key: 'DATE_DE_PUBLICATION', type: 'string', title: 'Date de publication', description: 'Date de publication de la fiche.', 'x-refersTo': 'http://schema.org/dateCreated', extract: (f) => text(f, 'DATE_DE_PUBLICATION') },
  { key: 'DATE_LIMITE_DELIVRANCE', type: 'string', title: 'Date limite de délivrance', description: 'Date limite de délivrance après la date de fin d’enregistrement.', extract: (f) => text(f, 'DATE_LIMITE_DELIVRANCE') },
  { key: 'PREREQUIS_ENTREE_FORMATION', type: 'string', title: 'Prérequis à l’entrée en formation', description: 'Prérequis nécessaires à l’entrée en formation.', 'x-display': 'markdown', extract: (f) => richText(f, 'PREREQUIS_ENTREE_FORMATION') },
  { key: 'PREREQUIS_VALIDATION_CERTIFICATION', type: 'string', title: 'Prérequis à la validation', description: 'Prérequis nécessaires à la validation de la certification.', 'x-display': 'markdown', extract: (f) => richText(f, 'PREREQUIS_VALIDATION_CERTIFICATION') },
  { key: 'NOUVELLES_CERTIFICATIONS', type: 'string', title: 'Nouvelles certifications', description: 'Numéros des certifications qui remplacent celle-ci.', separator: SEP, extract: (f) => itemsJoin(f, 'NOUVELLES_CERTIFICATIONS', 'NOUVELLE_CERTIFICATION', 'ID_FICHE_NOUVELLE_CERTIFICATION') },
  { key: 'ANCIENNES_CERTIFICATIONS', type: 'string', title: 'Anciennes certifications', description: 'Numéros des certifications antérieures remplacées.', separator: SEP, extract: (f) => itemsJoin(f, 'ANCIENNES_CERTIFICATIONS', 'ANCIENNE_CERTIFICATION', 'ID_FICHE_ANCIENNE_CERTIFICATION') },
  { key: 'CORRESPONDANCES', type: 'string', title: 'Correspondances', description: 'Équivalences entre certifications ou blocs de compétences.', extract: (f) => correspondances(f) }
]

export const rs: Repertoire = {
  code: 'RS',
  datasetTitle: 'Certifications RS',
  datasetDescription: DATASET_DESCRIPTION,
  schema
}
