package com.boa.apid.core.mentoring.service;

import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.mentoring.dto.MentorDirectoryDto;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.skills.entity.Skill;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class MentorDirectoryService {

    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;

    public MentorDirectoryService(UserRepository userRepository, EmployeeRepository employeeRepository) {
        this.userRepository = userRepository;
        this.employeeRepository = employeeRepository;
    }

    public List<MentorDirectoryDto> listActiveMentors() {
        List<User> mentors = userRepository.findActiveMentorsWithSkills();
        if (mentors.isEmpty()) {
            return List.of();
        }

        List<Long> userIds = mentors.stream().map(User::getId).toList();
        Map<Long, Employee> employeesByUserId = employeeRepository.findActiveDetailedByUserIdIn(userIds).stream()
                .collect(Collectors.toMap(Employee::getUserId, Function.identity()));

        return mentors.stream()
                .filter(user -> employeesByUserId.containsKey(user.getId()))
                .map(user -> toDto(user, employeesByUserId.get(user.getId())))
                .sorted(Comparator.comparing(MentorDirectoryDto::fullName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public long countActiveMentors() {
        return userRepository.countActiveMentors();
    }

    private MentorDirectoryDto toDto(User user, Employee employee) {
        List<MentorDirectoryDto.MentorSkillDto> skills = user.getSkills().stream()
                .filter(Skill::isActive)
                .sorted(Comparator.comparing(Skill::getName, String.CASE_INSENSITIVE_ORDER))
                .map(skill -> new MentorDirectoryDto.MentorSkillDto(
                        skill.getId(),
                        skill.getName(),
                        skill.getCategory()
                ))
                .toList();

        return new MentorDirectoryDto(
                user.getId(),
                user.getUsername(),
                employee == null ? null : employee.getEmployeeNumber(),
                employee == null ? user.getUsername() : employee.getFullName(),
                employee == null ? null : employee.getDepartmentName(),
                skills
        );
    }
}
