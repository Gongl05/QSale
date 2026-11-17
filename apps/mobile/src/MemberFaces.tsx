import { View } from 'react-native';
import { displayName, type PlanMember } from '@qsale/contracts';
import { Avatar } from './Avatar';
import { Text, styles } from './ui';

/** "Cami, Diego y 3 más" with their faces, so a plan feels like a group of friends. */
export function MemberFaces({
  members,
  joinedCount,
}: {
  members: PlanMember[];
  joinedCount: number;
}) {
  if (!members.length) return <Text style={styles.muted}>Aún nadie se une. ¡Comparte el plan!</Text>;
  const names = members.slice(0, 2).map((member) => displayName(member.name, member.nickname));
  const rest = joinedCount - names.length;
  const text =
    rest > 0
      ? `${names.join(', ')} y ${rest} más`
      : names.length === 2
        ? `${names[0]} y ${names[1]}`
        : names[0];
  return (
    <View style={styles.statRow} accessible accessibilityLabel={'Van ' + text}>
      <View style={{ flexDirection: 'row' }}>
        {members.slice(0, 4).map((member, index) => (
          <View
            key={member.userId}
            style={{
              marginLeft: index ? -9 : 0,
              borderWidth: 2,
              borderColor: '#fff',
              borderRadius: 17,
            }}
          >
            <Avatar
              userId={member.userId}
              version={member.avatarVersion}
              name={member.name}
              size={30}
            />
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
