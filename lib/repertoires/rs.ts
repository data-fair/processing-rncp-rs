import type { Repertoire, Field } from './common.ts'
import {
  SEP, text, richText, itemsJoin, directJoin,
  juryActif, juryComposition, statistiquesPromotions, publicationDecret, correspondances
} from './common.ts'

const DATASET_DESCRIPTION = `**France compétences** a la responsabilité confiée par le législateur d’enregistrer, de mettre à jour et de rendre accessible les certifications inscrites au Répertoire spécifique (RS).

Les certifications et habilitations enregistrées au **RS** correspondent à des compétences professionnelles complémentaires aux certifications professionnelles.

Jeu de données généré à partir du flux V4-1 publié sur data.gouv.fr (mise à jour hebdomadaire).`

const DATASET_SUMMARY = 'Le Répertoire spécifique (RS), géré par France compétences, liste les certifications et habilitations professionnelles complémentaires aux certifications du RNCP (habilitations réglementaires, certifications professionnalisantes, compétences transversales). Pour chaque fiche : intitulé, organismes certificateurs, niveaux, compétences attestées et secteurs d’activité. Ressource clé pour la formation, la VAE et l’insertion professionnelle.'

const schema: Field[] = [
  // ---- Colonnes historiques (ordre conservé pour la stabilité du jeu de données) ----
  { key: 'ID_FICHE', type: 'integer', title: 'Identifiant de fiche', description: 'Identifiant numérique interne de la fiche chez France compétences, stable dans le temps et utilisé pour relier les fiches entre elles.', extract: (f) => text(f, 'ID_FICHE') },
  { key: 'NUMERO_FICHE', type: 'string', title: 'Numéro de fiche', description: 'Code public de la certification, préfixé « RS » pour le Répertoire spécifique (ex. RS2381).', extract: (f) => text(f, 'NUMERO_FICHE') },
  { key: 'INTITULE', type: 'string', title: 'Intitulé', description: 'Intitulé officiel de la certification ou habilitation tel qu’enregistré par France compétences.', 'x-refersTo': 'http://www.w3.org/2000/01/rdf-schema#label', extract: (f) => text(f, 'INTITULE') },
  { key: 'ETAT_FICHE', type: 'string', title: 'État de la fiche', description: 'Statut de la fiche : « Publiée » (active et consultable), « Dépubliée/Archivée », ou en cours de modification.', enum: ['Publiée', 'Dépubliée/Archivée', 'Modifications à valider', 'Modifications à valider par le ministère'], extract: (f) => text(f, 'ETAT_FICHE') },
  { key: 'FORMACODES', type: 'string', title: 'Codes Formacode', description: 'Codes Formacode® (thésaurus du Centre Inffo) des domaines de formation couverts par la certification.', separator: SEP, extract: (f) => itemsJoin(f, 'FORMACODES', 'FORMACODE', 'CODE') },
  { key: 'FORMALIBELLES', type: 'string', title: 'Libellés Formacode', description: 'Libellés des domaines de formation correspondant aux codes Formacode®.', separator: SEP, extract: (f) => itemsJoin(f, 'FORMACODES', 'FORMACODE', 'LIBELLE') },
  { key: 'CODES_NSF', type: 'string', title: 'Codes NSF', description: 'Codes de la Nomenclature des spécialités de formation (NSF) situant la certification par domaine.', separator: SEP, extract: (f) => itemsJoin(f, 'CODES_NSF', 'NSF', 'CODE') },
  { key: 'INTITULE_NSF', type: 'string', title: 'Intitulés NSF', description: 'Libellés des spécialités de formation (NSF) correspondant aux codes NSF.', separator: SEP, extract: (f) => itemsJoin(f, 'CODES_NSF', 'NSF', ['LIBELLE', 'INTITULE']) },
  { key: 'CERTIFICATEURS', type: 'string', title: 'Certificateurs', description: 'Raisons sociales des organismes habilités à délivrer la certification ; alignées avec la colonne SIRET des certificateurs.', separator: SEP, extract: (f) => itemsJoin(f, 'CERTIFICATEURS', 'CERTIFICATEUR', 'NOM_CERTIFICATEUR') },
  { key: 'CAPACITES_ATTESTEES', type: 'string', title: 'Compétences attestées', description: 'Compétences et capacités que la certification atteste, telles que décrites dans la fiche.', 'x-display': 'markdown', extract: (f) => richText(f, 'CAPACITES_ATTESTEES') },
  { key: 'LIEN_URL_DESCRIPTION', type: 'string', title: 'Lien vers le descriptif', description: 'URL de la page officielle décrivant la certification sur le site de France compétences.', 'x-refersTo': 'https://schema.org/WebPage', extract: (f) => richText(f, 'LIEN_URL_DESCRIPTION') },
  { key: 'REGLEMENTATIONS_ACTIVITES', type: 'string', title: 'Réglementations d’activités', description: 'Réglementations encadrant l’exercice des activités visées (habilitations, autorisations, conditions légales), le cas échéant.', 'x-display': 'markdown', extract: (f) => richText(f, 'REGLEMENTATIONS_ACTIVITES') },
  { key: 'DATE_FIN_ENREGISTREMENT', type: 'string', format: 'date', title: 'Date de fin d’enregistrement', description: 'Date d’échéance de l’enregistrement au répertoire ; au-delà, la certification ne peut plus être délivrée (sauf date limite de délivrance distincte).', 'x-refersTo': 'https://schema.org/endDate', extract: (f) => text(f, 'DATE_FIN_ENREGISTREMENT') },
  { key: 'TYPE_ENREGISTREMENT', type: 'string', title: 'Type d’enregistrement', description: 'Modalité d’enregistrement : « de droit » (relevant d’un ministère) ou « sur demande » (après instruction par France compétences).', enum: ['Enregistrement de droit', 'Enregistrement sur demande'], extract: (f) => text(f, 'TYPE_ENREGISTREMENT') },
  { key: 'OBJECTIFS_CONTEXTE', type: 'string', title: 'Objectifs et contexte', description: 'Objectifs de la certification et contexte professionnel dans lequel elle s’inscrit.', 'x-display': 'markdown', 'x-refersTo': 'http://schema.org/description', extract: (f) => richText(f, 'OBJECTIFS_CONTEXTE') },
  { key: 'NIVEAU_MAITRISE_COMPETENCES', type: 'string', title: 'Niveau de maîtrise des compétences', description: 'Niveaux de maîtrise attendus pour les compétences visées par la certification.', 'x-display': 'markdown', extract: (f) => richText(f, 'NIVEAU_MAITRISE_COMPETENCES') },
  { key: 'MODALITES_RENOUVELLEMENT', type: 'string', title: 'Modalités de renouvellement', description: 'Conditions et périodicité de renouvellement de la certification pour son titulaire.', 'x-display': 'markdown', extract: (f) => richText(f, 'MODALITES_RENOUVELLEMENT') },
  { key: 'VALIDATION_PARTIELLE', type: 'boolean', title: 'Validation partielle', description: 'Indique si la certification peut être obtenue partiellement, par acquisition progressive de blocs ou modules.', extract: (f) => text(f, 'VALIDATION_PARTIELLE') },
  { key: 'ACTIF', type: 'boolean', title: 'Active', description: 'Indique si la certification est active (enregistrement en cours de validité) ou inactive.', extract: (f) => text(f, 'ACTIF') },

  // ---- Colonnes ajoutées (flux V4-1, non destructif) ----
  { key: 'SI_JURY_FI', type: 'boolean', title: 'Voie d’accès : formation initiale', description: 'Certification accessible par un parcours de formation initiale sous statut d’élève ou d’étudiant.', extract: (f) => juryActif(f, 'SI_JURY_FI') },
  { key: 'JURY_FI', type: 'string', title: 'Jury — formation initiale', description: 'Composition du jury de certification pour la voie de la formation initiale.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_FI') },
  { key: 'SI_JURY_FC', type: 'boolean', title: 'Voie d’accès : formation continue', description: 'Certification accessible après un parcours de formation continue.', extract: (f) => juryActif(f, 'SI_JURY_FC') },
  { key: 'JURY_FC', type: 'string', title: 'Jury — formation continue', description: 'Composition du jury de certification pour la voie de la formation continue.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_FC') },
  { key: 'SI_JURY_CQ', type: 'boolean', title: 'Voie d’accès : contrat de professionnalisation', description: 'Certification accessible en contrat de professionnalisation.', extract: (f) => juryActif(f, 'SI_JURY_CQ') },
  { key: 'JURY_CQ', type: 'string', title: 'Jury — contrat de professionnalisation', description: 'Composition du jury de certification pour la voie du contrat de professionnalisation.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_CQ') },
  { key: 'SI_JURY_CL', type: 'boolean', title: 'Voie d’accès : candidature individuelle', description: 'Certification accessible par candidature individuelle, hors parcours de formation.', extract: (f) => juryActif(f, 'SI_JURY_CL') },
  { key: 'JURY_CL', type: 'string', title: 'Jury — candidature individuelle', description: 'Composition du jury de certification pour la voie de la candidature individuelle.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_CL') },
  { key: 'SI_JURY_VAE', type: 'boolean', title: 'Voie d’accès : VAE', description: 'Certification accessible par la validation des acquis de l’expérience (VAE).', extract: (f) => juryActif(f, 'SI_JURY_VAE') },
  { key: 'JURY_VAE', type: 'string', title: 'Jury — VAE', description: 'Composition du jury de certification pour la voie de la VAE.', 'x-display': 'markdown', extract: (f) => juryComposition(f, 'SI_JURY_VAE') },
  { key: 'CCN_1_NUMERO', type: 'string', title: 'CCN 1 — numéro', description: 'Numéro de brochure de la 1re convention collective nationale rattachée à la certification.', extract: (f) => directJoin(f, 'CCN_1', 'NUMERO') },
  { key: 'CCN_1_LIBELLE', type: 'string', title: 'CCN 1 — libellé', description: 'Intitulé de la 1re convention collective nationale rattachée à la certification.', extract: (f) => directJoin(f, 'CCN_1', 'LIBELLE') },
  { key: 'CODES_IDCC', type: 'string', title: 'Codes IDCC', description: 'Codes IDCC (identifiant de convention collective) des branches professionnelles concernées.', separator: SEP, extract: (f) => itemsJoin(f, 'CODES_IDCC', 'IDCC', 'CODE') },
  { key: 'LIBELLES_IDCC', type: 'string', title: 'Libellés IDCC', description: 'Intitulés des conventions collectives correspondant aux codes IDCC.', separator: SEP, extract: (f) => itemsJoin(f, 'CODES_IDCC', 'IDCC', 'LIBELLE') },
  { key: 'DATE_DECISION', type: 'string', title: 'Date de décision', description: 'Date de la décision d’enregistrement de la certification par France compétences.', extract: (f) => text(f, 'DATE_DECISION') },
  { key: 'DATE_EFFET', type: 'string', title: 'Date d’effet', description: 'Date d’effet du dernier arrêté ou de la dernière décision concernant la certification.', 'x-refersTo': 'https://schema.org/startDate', extract: (f) => text(f, 'DATE_EFFET') },
  { key: 'DATE_DERNIER_JO', type: 'string', title: 'Date du dernier JO', description: 'Date de la dernière parution au Journal officiel (JO) ou Bulletin officiel (BO) concernant la certification.', extract: (f) => text(f, 'DATE_DERNIER_JO') },
  { key: 'DUREE_ENREGISTREMENT', type: 'string', title: 'Durée d’enregistrement', description: 'Durée de l’enregistrement de la certification au répertoire, exprimée en années.', extract: (f) => text(f, 'DUREE_ENREGISTREMENT') },
  { key: 'DUREE_VALIDITE', type: 'string', title: 'Durée de validité', description: 'Durée de validité de la certification pour son titulaire, exprimée en années.', extract: (f) => text(f, 'DUREE_VALIDITE') },
  { key: 'EXISTENCE_PARTENAIRES', type: 'boolean', title: 'Existence de partenaires', description: 'Indique si des organismes partenaires sont habilités à préparer ou délivrer la certification (voir colonnes Partenaires).', extract: (f) => text(f, 'EXISTENCE_PARTENAIRES') },
  { key: 'PARTENAIRES', type: 'string', title: 'Partenaires', description: 'Raisons sociales des organismes partenaires habilités à préparer à la certification.', separator: SEP, extract: (f) => itemsJoin(f, 'PARTENAIRES', 'PARTENAIRE', 'NOM_PARTENAIRE') },
  { key: 'SIRET_PARTENAIRES', type: 'string', title: 'SIRET des partenaires', description: 'Numéros SIRET des organismes partenaires, alignés avec la colonne Partenaires.', separator: SEP, extract: (f) => itemsJoin(f, 'PARTENAIRES', 'PARTENAIRE', 'SIRET_PARTENAIRE') },
  { key: 'SIRET_CERTIFICATEURS', type: 'string', title: 'SIRET des certificateurs', description: 'Numéros SIRET des organismes certificateurs, alignés avec la colonne Certificateurs.', separator: SEP, extract: (f) => itemsJoin(f, 'CERTIFICATEURS', 'CERTIFICATEUR', 'SIRET_CERTIFICATEUR') },
  { key: 'VALIDATION_PARTIELLE_PERIMETRE', type: 'string', title: 'Périmètre de validation partielle', description: 'Blocs ou modules pouvant être validés séparément lorsque la validation partielle est possible.', 'x-display': 'markdown', extract: (f) => richText(f, 'VALIDATION_PARTIELLE_PERIMETRE') },
  { key: 'PUBLICATION_DECRET_GENERAL', type: 'string', title: 'Textes réglementaires (général)', description: 'Textes réglementaires généraux encadrant la certification (date et titre de publication au JO/BO).', extract: (f) => publicationDecret(f, 'PUBLICATION_DECRET_GENERAL') },
  { key: 'PUBLICATION_DECRET_CREATION', type: 'string', title: 'Textes réglementaires (création)', description: 'Arrêtés et décisions de création de la certification publiés au JO/BO (date et titre).', extract: (f) => publicationDecret(f, 'PUBLICATION_DECRET_CREATION') },
  { key: 'PUBLICATION_DECRET_AUTRE', type: 'string', title: 'Textes réglementaires (autres)', description: 'Autres textes réglementaires liés à la certification (date et titre de publication).', extract: (f) => publicationDecret(f, 'PUBLICATION_DECRET_AUTRE') },
  { key: 'STATISTIQUES_PROMOTIONS', type: 'string', title: 'Statistiques des promotions', description: 'Statistiques par année de promotion : nombre de certifiés, nombre via VAE et taux d’insertion professionnelle (à 6 mois et 2 ans).', extract: (f) => statistiquesPromotions(f) },
  { key: 'DATE_DE_PUBLICATION', type: 'string', title: 'Date de publication', description: 'Date de première publication de la fiche au répertoire.', 'x-refersTo': 'http://schema.org/dateCreated', extract: (f) => text(f, 'DATE_DE_PUBLICATION') },
  { key: 'DATE_LIMITE_DELIVRANCE', type: 'string', title: 'Date limite de délivrance', description: 'Date limite au-delà de laquelle la certification ne peut plus être délivrée, lorsqu’elle diffère de la date de fin d’enregistrement.', extract: (f) => text(f, 'DATE_LIMITE_DELIVRANCE') },
  { key: 'PREREQUIS_ENTREE_FORMATION', type: 'string', title: 'Prérequis à l’entrée en formation', description: 'Conditions et prérequis exigés pour entrer dans le parcours de formation menant à la certification.', 'x-display': 'markdown', extract: (f) => richText(f, 'PREREQUIS_ENTREE_FORMATION') },
  { key: 'PREREQUIS_VALIDATION_CERTIFICATION', type: 'string', title: 'Prérequis à la validation', description: 'Conditions et prérequis exigés pour valider et obtenir la certification.', 'x-display': 'markdown', extract: (f) => richText(f, 'PREREQUIS_VALIDATION_CERTIFICATION') },
  { key: 'NOUVELLES_CERTIFICATIONS', type: 'string', title: 'Nouvelles certifications', description: 'Identifiants de fiche (ID_FICHE) des certifications qui remplacent celle-ci.', separator: SEP, extract: (f) => itemsJoin(f, 'NOUVELLES_CERTIFICATIONS', 'NOUVELLE_CERTIFICATION', 'ID_FICHE_NOUVELLE_CERTIFICATION') },
  { key: 'ANCIENNES_CERTIFICATIONS', type: 'string', title: 'Anciennes certifications', description: 'Identifiants de fiche (ID_FICHE) des certifications antérieures que celle-ci remplace.', separator: SEP, extract: (f) => itemsJoin(f, 'ANCIENNES_CERTIFICATIONS', 'ANCIENNE_CERTIFICATION', 'ID_FICHE_ANCIENNE_CERTIFICATION') },
  { key: 'CORRESPONDANCES', type: 'string', title: 'Correspondances', description: 'Équivalences reconnues entre blocs de compétences de cette certification et ceux d’autres certifications (format « source → fiche cible (bloc) »).', extract: (f) => correspondances(f) }
]

export const rs: Repertoire = {
  code: 'RS',
  datasetTitle: 'Certifications RS',
  datasetDescription: DATASET_DESCRIPTION,
  datasetSummary: DATASET_SUMMARY,
  schema
}
