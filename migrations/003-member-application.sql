-- Add an unclassified application state; retain existing/new values and records.
ALTER TABLE lantian_members.business_member_profiles
 DROP CONSTRAINT business_member_profiles_shop_identity_check,
 ADD CONSTRAINT business_member_profiles_shop_identity_check
 CHECK (shop_identity IN ('existing','new','application'));
