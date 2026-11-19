-- Adds 'not_applicable' to customer_profiles_gender; existing values are preserved.
ALTER TABLE `customer_profiles` MODIFY `gender` ENUM('male', 'female', 'other', 'not_applicable') NULL;
