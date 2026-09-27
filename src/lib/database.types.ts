
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "attachments": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"body_positions": {
                  Row: {
                    "id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"equipment": {
                  Row: {
                    "category_id": string,"created_at": string,"description": string | null,"id": string,"name": string,"parent_id": string | null,"slug": string
                  }
                  Insert: {
                    "category_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"parent_id"?: string | null,"slug": string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"parent_id"?: string | null,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipment_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "equipment_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipment_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    }
                  ]
                },"equipment_assets": {
                  Row: {
                    "active": boolean,"attachment_id": string | null,"created_at": string,"equipment_id": string | null,"id": string,"license_name": string,"slug": string,"source_storage_path": string,"version": number
                  }
                  Insert: {
                    "active"?: boolean,"attachment_id"?: string | null,"created_at"?: string,"equipment_id"?: string | null,"id"?: string,"license_name": string,"slug": string,"source_storage_path": string,"version": number
                  }
                  Update: {
                    "active"?: boolean,"attachment_id"?: string | null,"created_at"?: string,"equipment_id"?: string | null,"id"?: string,"license_name"?: string,"slug"?: string,"source_storage_path"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipment_assets_attachment_id_fkey"
      columns: ["attachment_id"]
isOneToOne: false
      referencedRelation: "attachments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipment_assets_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    }
                  ]
                },"equipment_categories": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"parent_id": string | null,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"parent_id"?: string | null,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"parent_id"?: string | null,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipment_categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "equipment_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_aliases": {
                  Row: {
                    "alias": string,"content_id": string,"id": string,"normalized_alias": string
                  }
                  Insert: {
                    "alias": string,"content_id": string,"id"?: string,"normalized_alias": string
                  }
                  Update: {
                    "alias"?: string,"content_id"?: string,"id"?: string,"normalized_alias"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_aliases_content_id_fkey"
      columns: ["content_id"]
isOneToOne: false
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_attachments": {
                  Row: {
                    "attachment_id": string,"content_id": string,"notes": string | null
                  }
                  Insert: {
                    "attachment_id": string,"content_id": string,"notes"?: string | null
                  }
                  Update: {
                    "attachment_id"?: string,"content_id"?: string,"notes"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_attachments_attachment_id_fkey"
      columns: ["attachment_id"]
isOneToOne: false
      referencedRelation: "attachments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_attachments_content_id_fkey"
      columns: ["content_id"]
isOneToOne: false
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_biomechanics": {
                  Row: {
                    "body_position_id": string | null,"classification_confidence": Database["public"]['Enums']["classification_confidence"] | null,"content_id": string,"grip_id": string | null,"peak_resistance_position": Database["public"]['Enums']["peak_resistance_position"],"plane_id": string | null,"resistance_profile": Database["public"]['Enums']["resistance_profile"],"resistance_source_id": string | null,"reviewer_notes": string | null,"stance_id": string | null
                  }
                  Insert: {
                    "body_position_id"?: string | null,"classification_confidence"?: Database["public"]['Enums']["classification_confidence"] | null,"content_id": string,"grip_id"?: string | null,"peak_resistance_position"?: Database["public"]['Enums']["peak_resistance_position"],"plane_id"?: string | null,"resistance_profile"?: Database["public"]['Enums']["resistance_profile"],"resistance_source_id"?: string | null,"reviewer_notes"?: string | null,"stance_id"?: string | null
                  }
                  Update: {
                    "body_position_id"?: string | null,"classification_confidence"?: Database["public"]['Enums']["classification_confidence"] | null,"content_id"?: string,"grip_id"?: string | null,"peak_resistance_position"?: Database["public"]['Enums']["peak_resistance_position"],"plane_id"?: string | null,"resistance_profile"?: Database["public"]['Enums']["resistance_profile"],"resistance_source_id"?: string | null,"reviewer_notes"?: string | null,"stance_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_biomechanics_body_position_id_fkey"
      columns: ["body_position_id"]
isOneToOne: false
      referencedRelation: "body_positions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_biomechanics_content_id_fkey"
      columns: ["content_id"]
isOneToOne: true
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_biomechanics_grip_id_fkey"
      columns: ["grip_id"]
isOneToOne: false
      referencedRelation: "grips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_biomechanics_plane_id_fkey"
      columns: ["plane_id"]
isOneToOne: false
      referencedRelation: "planes_of_motion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_biomechanics_resistance_source_id_fkey"
      columns: ["resistance_source_id"]
isOneToOne: false
      referencedRelation: "resistance_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_biomechanics_stance_id_fkey"
      columns: ["stance_id"]
isOneToOne: false
      referencedRelation: "stances"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_content": {
                  Row: {
                    "common_mistakes": string | null,"created_at": string,"created_by": string | null,"difficulty": Database["public"]['Enums']["exercise_difficulty"] | null,"execution_instructions": string | null,"exercise_type": Database["public"]['Enums']["exercise_type"] | null,"family_id": string | null,"force_type": Database["public"]['Enums']["force_type"] | null,"form_cues": string | null,"id": string,"kind": Database["public"]['Enums']["content_kind"],"laterality": Database["public"]['Enums']["laterality"] | null,"mechanic": Database["public"]['Enums']["exercise_mechanic"] | null,"name": string,"owner_id": string | null,"range_of_motion_notes": string | null,"safety_notes": string | null,"setup_instructions": string | null,"short_description": string | null,"updated_at": string
                  }
                  Insert: {
                    "common_mistakes"?: string | null,"created_at"?: string,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["exercise_difficulty"] | null,"execution_instructions"?: string | null,"exercise_type"?: Database["public"]['Enums']["exercise_type"] | null,"family_id"?: string | null,"force_type"?: Database["public"]['Enums']["force_type"] | null,"form_cues"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["content_kind"],"laterality"?: Database["public"]['Enums']["laterality"] | null,"mechanic"?: Database["public"]['Enums']["exercise_mechanic"] | null,"name": string,"owner_id"?: string | null,"range_of_motion_notes"?: string | null,"safety_notes"?: string | null,"setup_instructions"?: string | null,"short_description"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "common_mistakes"?: string | null,"created_at"?: string,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["exercise_difficulty"] | null,"execution_instructions"?: string | null,"exercise_type"?: Database["public"]['Enums']["exercise_type"] | null,"family_id"?: string | null,"force_type"?: Database["public"]['Enums']["force_type"] | null,"form_cues"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["content_kind"],"laterality"?: Database["public"]['Enums']["laterality"] | null,"mechanic"?: Database["public"]['Enums']["exercise_mechanic"] | null,"name"?: string,"owner_id"?: string | null,"range_of_motion_notes"?: string | null,"safety_notes"?: string | null,"setup_instructions"?: string | null,"short_description"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_content_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "exercise_families"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_equipment": {
                  Row: {
                    "content_id": string,"equipment_id": string,"notes": string | null,"role": Database["public"]['Enums']["equipment_role"]
                  }
                  Insert: {
                    "content_id": string,"equipment_id": string,"notes"?: string | null,"role"?: Database["public"]['Enums']["equipment_role"]
                  }
                  Update: {
                    "content_id"?: string,"equipment_id"?: string,"notes"?: string | null,"role"?: Database["public"]['Enums']["equipment_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_equipment_content_id_fkey"
      columns: ["content_id"]
isOneToOne: false
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_equipment_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_families": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"parent_id": string | null,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"parent_id"?: string | null,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"parent_id"?: string | null,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_families_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "exercise_families"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_joint_actions": {
                  Row: {
                    "content_id": string,"joint_action_id": string,"notes": string | null,"role": Database["public"]['Enums']["joint_role"]
                  }
                  Insert: {
                    "content_id": string,"joint_action_id": string,"notes"?: string | null,"role": Database["public"]['Enums']["joint_role"]
                  }
                  Update: {
                    "content_id"?: string,"joint_action_id"?: string,"notes"?: string | null,"role"?: Database["public"]['Enums']["joint_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_joint_actions_content_id_fkey"
      columns: ["content_id"]
isOneToOne: false
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_joint_actions_joint_action_id_fkey"
      columns: ["joint_action_id"]
isOneToOne: false
      referencedRelation: "joint_actions"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_joints": {
                  Row: {
                    "content_id": string,"joint_id": string,"notes": string | null,"role": Database["public"]['Enums']["joint_role"]
                  }
                  Insert: {
                    "content_id": string,"joint_id": string,"notes"?: string | null,"role": Database["public"]['Enums']["joint_role"]
                  }
                  Update: {
                    "content_id"?: string,"joint_id"?: string,"notes"?: string | null,"role"?: Database["public"]['Enums']["joint_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_joints_content_id_fkey"
      columns: ["content_id"]
isOneToOne: false
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_joints_joint_id_fkey"
      columns: ["joint_id"]
isOneToOne: false
      referencedRelation: "joints"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_media": {
                  Row: {
                    "asset_group_id": string,"camera_angle": Database["public"]['Enums']["camera_angle"] | null,"character_presentation": string,"content_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["media_kind"],"license_name": string,"scene_id": string | null,"source_credit": string | null,"storage_bucket": string,"storage_path": string
                  }
                  Insert: {
                    "asset_group_id": string,"camera_angle"?: Database["public"]['Enums']["camera_angle"] | null,"character_presentation"?: string,"content_id": string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["media_kind"],"license_name": string,"scene_id"?: string | null,"source_credit"?: string | null,"storage_bucket": string,"storage_path": string
                  }
                  Update: {
                    "asset_group_id"?: string,"camera_angle"?: Database["public"]['Enums']["camera_angle"] | null,"character_presentation"?: string,"content_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["media_kind"],"license_name"?: string,"scene_id"?: string | null,"source_credit"?: string | null,"storage_bucket"?: string,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_media_content_id_fkey"
      columns: ["content_id"]
isOneToOne: false
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_media_scene_id_fkey"
      columns: ["scene_id"]
isOneToOne: false
      referencedRelation: "exercise_scenes"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_movement_patterns": {
                  Row: {
                    "content_id": string,"movement_pattern_id": string
                  }
                  Insert: {
                    "content_id": string,"movement_pattern_id": string
                  }
                  Update: {
                    "content_id"?: string,"movement_pattern_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_movement_patterns_content_id_fkey"
      columns: ["content_id"]
isOneToOne: false
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_movement_patterns_movement_pattern_id_fkey"
      columns: ["movement_pattern_id"]
isOneToOne: false
      referencedRelation: "movement_patterns"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_muscles": {
                  Row: {
                    "content_id": string,"muscle_id": string,"notes": string | null,"role": Database["public"]['Enums']["muscle_role"]
                  }
                  Insert: {
                    "content_id": string,"muscle_id": string,"notes"?: string | null,"role": Database["public"]['Enums']["muscle_role"]
                  }
                  Update: {
                    "content_id"?: string,"muscle_id"?: string,"notes"?: string | null,"role"?: Database["public"]['Enums']["muscle_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_muscles_content_id_fkey"
      columns: ["content_id"]
isOneToOne: false
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_muscles_muscle_id_fkey"
      columns: ["muscle_id"]
isOneToOne: false
      referencedRelation: "muscles"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_relations": {
                  Row: {
                    "created_at": string,"id": string,"notes": string | null,"relation_type": Database["public"]['Enums']["exercise_relation_type"],"source_exercise_id": string,"target_exercise_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"relation_type": Database["public"]['Enums']["exercise_relation_type"],"source_exercise_id": string,"target_exercise_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"relation_type"?: Database["public"]['Enums']["exercise_relation_type"],"source_exercise_id"?: string,"target_exercise_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_relations_source_exercise_id_fkey"
      columns: ["source_exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_relations_target_exercise_id_fkey"
      columns: ["target_exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_scenes": {
                  Row: {
                    "camera_position_x": number,"camera_position_y": number,"camera_position_z": number,"camera_target_x": number,"camera_target_y": number,"camera_target_z": number,"content_id": string,"created_at": string,"default_camera_angle": Database["public"]['Enums']["camera_angle"],"duration_ms": number,"id": string,"rig_id": string,"updated_at": string
                  }
                  Insert: {
                    "camera_position_x"?: number,"camera_position_y"?: number,"camera_position_z"?: number,"camera_target_x"?: number,"camera_target_y"?: number,"camera_target_z"?: number,"content_id": string,"created_at"?: string,"default_camera_angle"?: Database["public"]['Enums']["camera_angle"],"duration_ms": number,"id"?: string,"rig_id": string,"updated_at"?: string
                  }
                  Update: {
                    "camera_position_x"?: number,"camera_position_y"?: number,"camera_position_z"?: number,"camera_target_x"?: number,"camera_target_y"?: number,"camera_target_z"?: number,"content_id"?: string,"created_at"?: string,"default_camera_angle"?: Database["public"]['Enums']["camera_angle"],"duration_ms"?: number,"id"?: string,"rig_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_scenes_content_id_fkey"
      columns: ["content_id"]
isOneToOne: true
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_scenes_rig_id_fkey"
      columns: ["rig_id"]
isOneToOne: false
      referencedRelation: "rigs"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_submissions": {
                  Row: {
                    "created_at": string,"editorial_content_id": string | null,"id": string,"merged_into_exercise_id": string | null,"original_content_id": string,"owner_id": string,"related_exercise_id": string | null,"source_private_exercise_id": string | null,"status": Database["public"]['Enums']["submission_status"],"submitted_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"editorial_content_id"?: string | null,"id"?: string,"merged_into_exercise_id"?: string | null,"original_content_id": string,"owner_id": string,"related_exercise_id"?: string | null,"source_private_exercise_id"?: string | null,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"editorial_content_id"?: string | null,"id"?: string,"merged_into_exercise_id"?: string | null,"original_content_id"?: string,"owner_id"?: string,"related_exercise_id"?: string | null,"source_private_exercise_id"?: string | null,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_submissions_editorial_content_id_fkey"
      columns: ["editorial_content_id"]
isOneToOne: true
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_submissions_merged_into_exercise_id_fkey"
      columns: ["merged_into_exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_submissions_original_content_id_fkey"
      columns: ["original_content_id"]
isOneToOne: true
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_submissions_related_exercise_id_fkey"
      columns: ["related_exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_submissions_source_private_exercise_id_fkey"
      columns: ["source_private_exercise_id"]
isOneToOne: false
      referencedRelation: "private_exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_versions": {
                  Row: {
                    "approved_by": string | null,"content_id": string,"exercise_id": string,"id": string,"published_at": string,"source_submission_id": string | null,"version_number": number
                  }
                  Insert: {
                    "approved_by"?: string | null,"content_id": string,"exercise_id": string,"id"?: string,"published_at"?: string,"source_submission_id"?: string | null,"version_number": number
                  }
                  Update: {
                    "approved_by"?: string | null,"content_id"?: string,"exercise_id"?: string,"id"?: string,"published_at"?: string,"source_submission_id"?: string | null,"version_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_versions_content_id_fkey"
      columns: ["content_id"]
isOneToOne: true
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_versions_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_versions_source_submission_id_fkey"
      columns: ["source_submission_id"]
isOneToOne: false
      referencedRelation: "exercise_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "created_by": string | null,"current_content_id": string,"favorite_count": number,"id": string,"published_at": string | null,"reviewed_by": string | null,"slug": string,"status": Database["public"]['Enums']["publication_status"],"updated_at": string
                  }
                  Insert: {
                    "created_by"?: string | null,"current_content_id": string,"favorite_count"?: number,"id"?: string,"published_at"?: string | null,"reviewed_by"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["publication_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_by"?: string | null,"current_content_id"?: string,"favorite_count"?: number,"id"?: string,"published_at"?: string | null,"reviewed_by"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["publication_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercises_current_content_id_fkey"
      columns: ["current_content_id"]
isOneToOne: true
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"exercise_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"exercise_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"grips": {
                  Row: {
                    "id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"joint_actions": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"joint_id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"joint_id": string,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"joint_id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "joint_actions_joint_id_fkey"
      columns: ["joint_id"]
isOneToOne: false
      referencedRelation: "joints"
      referencedColumns: ["id"]
    }
                  ]
                },"joints": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"parent_id": string | null,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"parent_id"?: string | null,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"parent_id"?: string | null,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "joints_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "joints"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_events": {
                  Row: {
                    "action": Database["public"]['Enums']["moderation_action"],"actor_id": string,"comment": string | null,"created_at": string,"from_status": Database["public"]['Enums']["submission_status"] | null,"id": string,"reason": Database["public"]['Enums']["moderation_reason"] | null,"submission_id": string,"to_status": Database["public"]['Enums']["submission_status"]
                  }
                  Insert: {
                    "action": Database["public"]['Enums']["moderation_action"],"actor_id": string,"comment"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["submission_status"] | null,"id"?: string,"reason"?: Database["public"]['Enums']["moderation_reason"] | null,"submission_id": string,"to_status": Database["public"]['Enums']["submission_status"]
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["moderation_action"],"actor_id"?: string,"comment"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["submission_status"] | null,"id"?: string,"reason"?: Database["public"]['Enums']["moderation_reason"] | null,"submission_id"?: string,"to_status"?: Database["public"]['Enums']["submission_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_events_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "exercise_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_reviews": {
                  Row: {
                    "action": Database["public"]['Enums']["moderation_action"],"comment": string | null,"created_at": string,"id": string,"reason": Database["public"]['Enums']["moderation_reason"] | null,"reviewer_id": string,"submission_id": string
                  }
                  Insert: {
                    "action": Database["public"]['Enums']["moderation_action"],"comment"?: string | null,"created_at"?: string,"id"?: string,"reason"?: Database["public"]['Enums']["moderation_reason"] | null,"reviewer_id": string,"submission_id": string
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["moderation_action"],"comment"?: string | null,"created_at"?: string,"id"?: string,"reason"?: Database["public"]['Enums']["moderation_reason"] | null,"reviewer_id"?: string,"submission_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_reviews_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "exercise_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"motion_joint_poses": {
                  Row: {
                    "keyframe_id": string,"position_x": number,"position_y": number,"position_z": number,"rig_joint_id": string,"rotation_w": number,"rotation_x": number,"rotation_y": number,"rotation_z": number
                  }
                  Insert: {
                    "keyframe_id": string,"position_x"?: number,"position_y"?: number,"position_z"?: number,"rig_joint_id": string,"rotation_w"?: number,"rotation_x"?: number,"rotation_y"?: number,"rotation_z"?: number
                  }
                  Update: {
                    "keyframe_id"?: string,"position_x"?: number,"position_y"?: number,"position_z"?: number,"rig_joint_id"?: string,"rotation_w"?: number,"rotation_x"?: number,"rotation_y"?: number,"rotation_z"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "motion_joint_poses_keyframe_id_fkey"
      columns: ["keyframe_id"]
isOneToOne: false
      referencedRelation: "motion_keyframes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "motion_joint_poses_rig_joint_id_fkey"
      columns: ["rig_joint_id"]
isOneToOne: false
      referencedRelation: "rig_joints"
      referencedColumns: ["id"]
    }
                  ]
                },"motion_keyframes": {
                  Row: {
                    "id": string,"phase_label": string | null,"position_ms": number,"scene_id": string
                  }
                  Insert: {
                    "id"?: string,"phase_label"?: string | null,"position_ms": number,"scene_id": string
                  }
                  Update: {
                    "id"?: string,"phase_label"?: string | null,"position_ms"?: number,"scene_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "motion_keyframes_scene_id_fkey"
      columns: ["scene_id"]
isOneToOne: false
      referencedRelation: "exercise_scenes"
      referencedColumns: ["id"]
    }
                  ]
                },"motion_phase_annotations": {
                  Row: {
                    "end_ms": number,"id": string,"joint_action_id": string | null,"label": string,"note": string | null,"scene_id": string,"start_ms": number
                  }
                  Insert: {
                    "end_ms": number,"id"?: string,"joint_action_id"?: string | null,"label": string,"note"?: string | null,"scene_id": string,"start_ms": number
                  }
                  Update: {
                    "end_ms"?: number,"id"?: string,"joint_action_id"?: string | null,"label"?: string,"note"?: string | null,"scene_id"?: string,"start_ms"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "motion_phase_annotations_joint_action_id_fkey"
      columns: ["joint_action_id"]
isOneToOne: false
      referencedRelation: "joint_actions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "motion_phase_annotations_scene_id_fkey"
      columns: ["scene_id"]
isOneToOne: false
      referencedRelation: "exercise_scenes"
      referencedColumns: ["id"]
    }
                  ]
                },"movement_patterns": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"muscles": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"parent_id": string | null,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"parent_id"?: string | null,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"parent_id"?: string | null,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "muscles_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "muscles"
      referencedColumns: ["id"]
    }
                  ]
                },"planes_of_motion": {
                  Row: {
                    "id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"private_exercises": {
                  Row: {
                    "content_id": string,"copied_from_exercise_id": string | null,"created_at": string,"id": string,"owner_id": string,"updated_at": string
                  }
                  Insert: {
                    "content_id": string,"copied_from_exercise_id"?: string | null,"created_at"?: string,"id"?: string,"owner_id": string,"updated_at"?: string
                  }
                  Update: {
                    "content_id"?: string,"copied_from_exercise_id"?: string | null,"created_at"?: string,"id"?: string,"owner_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "private_exercises_content_id_fkey"
      columns: ["content_id"]
isOneToOne: true
      referencedRelation: "exercise_content"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "private_exercises_copied_from_exercise_id_fkey"
      columns: ["copied_from_exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"render_jobs": {
                  Row: {
                    "attempt_count": number,"completed_at": string | null,"error_code": string | null,"id": string,"queued_at": string,"requested_by": string | null,"scene_id": string,"started_at": string | null,"status": Database["public"]['Enums']["render_status"]
                  }
                  Insert: {
                    "attempt_count"?: number,"completed_at"?: string | null,"error_code"?: string | null,"id"?: string,"queued_at"?: string,"requested_by"?: string | null,"scene_id": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["render_status"]
                  }
                  Update: {
                    "attempt_count"?: number,"completed_at"?: string | null,"error_code"?: string | null,"id"?: string,"queued_at"?: string,"requested_by"?: string | null,"scene_id"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["render_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "render_jobs_scene_id_fkey"
      columns: ["scene_id"]
isOneToOne: false
      referencedRelation: "exercise_scenes"
      referencedColumns: ["id"]
    }
                  ]
                },"resistance_sources": {
                  Row: {
                    "id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rig_joints": {
                  Row: {
                    "anatomical_joint_id": string | null,"id": string,"max_x_degrees": number | null,"max_y_degrees": number | null,"max_z_degrees": number | null,"min_x_degrees": number | null,"min_y_degrees": number | null,"min_z_degrees": number | null,"name": string,"parent_joint_id": string | null,"rig_id": string,"slug": string
                  }
                  Insert: {
                    "anatomical_joint_id"?: string | null,"id"?: string,"max_x_degrees"?: number | null,"max_y_degrees"?: number | null,"max_z_degrees"?: number | null,"min_x_degrees"?: number | null,"min_y_degrees"?: number | null,"min_z_degrees"?: number | null,"name": string,"parent_joint_id"?: string | null,"rig_id": string,"slug": string
                  }
                  Update: {
                    "anatomical_joint_id"?: string | null,"id"?: string,"max_x_degrees"?: number | null,"max_y_degrees"?: number | null,"max_z_degrees"?: number | null,"min_x_degrees"?: number | null,"min_y_degrees"?: number | null,"min_z_degrees"?: number | null,"name"?: string,"parent_joint_id"?: string | null,"rig_id"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rig_joints_anatomical_joint_id_fkey"
      columns: ["anatomical_joint_id"]
isOneToOne: false
      referencedRelation: "joints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rig_joints_parent_joint_id_fkey"
      columns: ["parent_joint_id"]
isOneToOne: false
      referencedRelation: "rig_joints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rig_joints_rig_id_fkey"
      columns: ["rig_id"]
isOneToOne: false
      referencedRelation: "rigs"
      referencedColumns: ["id"]
    }
                  ]
                },"rigs": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"license_name": string,"name": string,"source_storage_path": string,"version": number
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"license_name": string,"name": string,"source_storage_path": string,"version": number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"license_name"?: string,"name"?: string,"source_storage_path"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"roles": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"scene_equipment": {
                  Row: {
                    "anchor_joint_id": string | null,"asset_id": string,"id": string,"position_x": number,"position_y": number,"position_z": number,"rotation_w": number,"rotation_x": number,"rotation_y": number,"rotation_z": number,"scale": number,"scene_id": string
                  }
                  Insert: {
                    "anchor_joint_id"?: string | null,"asset_id": string,"id"?: string,"position_x"?: number,"position_y"?: number,"position_z"?: number,"rotation_w"?: number,"rotation_x"?: number,"rotation_y"?: number,"rotation_z"?: number,"scale"?: number,"scene_id": string
                  }
                  Update: {
                    "anchor_joint_id"?: string | null,"asset_id"?: string,"id"?: string,"position_x"?: number,"position_y"?: number,"position_z"?: number,"rotation_w"?: number,"rotation_x"?: number,"rotation_y"?: number,"rotation_z"?: number,"scale"?: number,"scene_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scene_equipment_anchor_joint_id_fkey"
      columns: ["anchor_joint_id"]
isOneToOne: false
      referencedRelation: "rig_joints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scene_equipment_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "equipment_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scene_equipment_scene_id_fkey"
      columns: ["scene_id"]
isOneToOne: false
      referencedRelation: "exercise_scenes"
      referencedColumns: ["id"]
    }
                  ]
                },"stances": {
                  Row: {
                    "id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"submission_media": {
                  Row: {
                    "created_at": string,"media_id": string,"submission_id": string
                  }
                  Insert: {
                    "created_at"?: string,"media_id": string,"submission_id": string
                  }
                  Update: {
                    "created_at"?: string,"media_id"?: string,"submission_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submission_media_media_id_fkey"
      columns: ["media_id"]
isOneToOne: true
      referencedRelation: "exercise_media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submission_media_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "exercise_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"taxonomy_suggestions": {
                  Row: {
                    "created_at": string,"explanation": string | null,"id": string,"submission_id": string,"suggested_name": string,"taxonomy_name": string
                  }
                  Insert: {
                    "created_at"?: string,"explanation"?: string | null,"id"?: string,"submission_id": string,"suggested_name": string,"taxonomy_name": string
                  }
                  Update: {
                    "created_at"?: string,"explanation"?: string | null,"id"?: string,"submission_id"?: string,"suggested_name"?: string,"taxonomy_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "taxonomy_suggestions_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "exercise_submissions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "app_role": "user"|"reviewer"|"admin","camera_angle": "front"|"side"|"three_quarter"|"custom","classification_confidence": "low"|"medium"|"high","content_kind": "private_draft"|"submission_original"|"submission_editorial"|"catalog_candidate"|"published_version","equipment_role": "required"|"optional","exercise_difficulty": "beginner"|"intermediate"|"advanced","exercise_mechanic": "compound"|"isolation","exercise_relation_type": "variation_of"|"similar_to"|"progression_of"|"regression_of"|"alternative_equipment_for"|"same_movement_pattern_as","exercise_type": "strength"|"mobility"|"plyometric"|"isometric"|"other","force_type": "push"|"pull"|"static"|"mixed","joint_role": "primary"|"secondary"|"stabilization","laterality": "unilateral"|"bilateral"|"alternating","media_kind": "webm"|"mp4"|"poster"|"glb_source"|"gltf_source","moderation_action": "submit"|"begin_review"|"request_changes"|"resubmit"|"approve"|"reject"|"merge"|"withdraw"|"edit","moderation_reason": "duplicate"|"incorrect_name"|"incorrect_exercise_family"|"incorrect_primary_muscle"|"incorrect_secondary_muscle"|"incorrect_joint"|"incorrect_joint_action"|"missing_joint_action"|"incorrect_equipment"|"incorrect_biomechanics"|"incorrect_resistance_profile"|"should_be_alias"|"should_be_variation"|"unsafe_or_unclear_demonstration"|"poor_media"|"insufficient_information"|"other","muscle_role": "primary"|"secondary"|"stabilizer","peak_resistance_position": "beginning"|"middle"|"end"|"multiple"|"unknown","publication_status": "pending_media"|"published"|"withdrawn","render_status": "queued"|"running"|"succeeded"|"failed","resistance_profile": "ascending"|"descending"|"bell_shaped"|"relatively_constant"|"variable_complex"|"unknown","submission_status": "draft"|"submitted"|"in_review"|"changes_requested"|"approved"|"rejected"|"merged"|"withdrawn"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["user", "reviewer", "admin"],"camera_angle": ["front", "side", "three_quarter", "custom"],"classification_confidence": ["low", "medium", "high"],"content_kind": ["private_draft", "submission_original", "submission_editorial", "catalog_candidate", "published_version"],"equipment_role": ["required", "optional"],"exercise_difficulty": ["beginner", "intermediate", "advanced"],"exercise_mechanic": ["compound", "isolation"],"exercise_relation_type": ["variation_of", "similar_to", "progression_of", "regression_of", "alternative_equipment_for", "same_movement_pattern_as"],"exercise_type": ["strength", "mobility", "plyometric", "isometric", "other"],"force_type": ["push", "pull", "static", "mixed"],"joint_role": ["primary", "secondary", "stabilization"],"laterality": ["unilateral", "bilateral", "alternating"],"media_kind": ["webm", "mp4", "poster", "glb_source", "gltf_source"],"moderation_action": ["submit", "begin_review", "request_changes", "resubmit", "approve", "reject", "merge", "withdraw", "edit"],"moderation_reason": ["duplicate", "incorrect_name", "incorrect_exercise_family", "incorrect_primary_muscle", "incorrect_secondary_muscle", "incorrect_joint", "incorrect_joint_action", "missing_joint_action", "incorrect_equipment", "incorrect_biomechanics", "incorrect_resistance_profile", "should_be_alias", "should_be_variation", "unsafe_or_unclear_demonstration", "poor_media", "insufficient_information", "other"],"muscle_role": ["primary", "secondary", "stabilizer"],"peak_resistance_position": ["beginning", "middle", "end", "multiple", "unknown"],"publication_status": ["pending_media", "published", "withdrawn"],"render_status": ["queued", "running", "succeeded", "failed"],"resistance_profile": ["ascending", "descending", "bell_shaped", "relatively_constant", "variable_complex", "unknown"],"submission_status": ["draft", "submitted", "in_review", "changes_requested", "approved", "rejected", "merged", "withdrawn"]
          }
        }
} as const

